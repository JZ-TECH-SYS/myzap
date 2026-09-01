const Guards = require('./guards');
const { sendDefault } = require('./defaultMessageService');
const EmpresaIA = require('./empresaIA');
const AgenteClient = require('./agenteClient');
const MessageSender = require('../events/messageSender');
const ChatHistoryHelper = require('../events/chatHistory');
const customLogger = require('../../../util/customLogger');
const { TEMPO_MENSAGEM_PADRAO_DEFAULT, LOG_PREFIX } = require('./iaConfig');
const processingLock = require('./processingLock');

// Registrar resposta da IA no cache (usado para evitar loop no self-test)
const { registerIAResponse } = require('./iaResponseCache');

/**
 * Engine de decisão: executa guards em sequência e toma ação apropriada.
 * Centraliza toda a lógica de quando processar IA vs mensagem padrão.
 */
// Mensagens que chegam ENQUANTO o bot processa outra (turno leva 5–20s) eram
// DESCARTADAS — cliente que manda rajada perdia 3 de 4 mensagens e achava que
// o bot morreu (caso real: Capucho, 31/08). Agora entram numa fila por número
// e são drenadas como UMA mensagem combinada ao fim do turno.
const filaPendentes = new Map();
const FILA_MAX = 5;

async function process({
  message,
  client,
  session,
  sessionkey,
  numero,
  msgBody,
  empresa,
  payload,
  responseDefault
}) {
  customLogger.debug(`${LOG_PREFIX} Iniciando para ${numero}`);

  const chaveFila = `${session || ''}::${sessionkey || ''}::${numero || ''}`;

  if (!processingLock.acquire({ session, sessionkey, numero })) {
    const texto = typeof msgBody === 'string' ? msgBody.trim() : '';
    if (texto) {
      const fila = filaPendentes.get(chaveFila) || [];
      if (fila.length < FILA_MAX) fila.push(texto);
      filaPendentes.set(chaveFila, fila);
      customLogger.debug(`${LOG_PREFIX} Em atendimento; mensagem enfileirada (${fila.length}) para ${numero}`);
    }
    return true;
  }

  try {
    return await processInternal({
      message,
      client,
      session,
      sessionkey,
      numero,
      msgBody,
      empresa,
      payload,
      responseDefault
    });
  } finally {
    processingLock.release({ session, sessionkey, numero });

    const fila = filaPendentes.get(chaveFila);
    if (fila && fila.length) {
      filaPendentes.delete(chaveFila);
      const combinado = fila.join('\n');
      customLogger.info(`${LOG_PREFIX} Drenando ${fila.length} mensagem(ns) enfileirada(s) de ${numero}`);
      setImmediate(() => {
        process({
          message: { ...message, body: combinado, agenteAudioBase64: null, agenteAudioMime: null },
          client,
          session,
          sessionkey,
          numero,
          msgBody: combinado,
          empresa,
          payload: { ...payload, body: combinado },
          responseDefault
        }).catch((e) => customLogger.error(`${LOG_PREFIX} Erro ao drenar fila`, e?.message || e));
      });
    }
  }
}

/**
 * Processamento interno após adquirir o lock
 */
async function processInternal({
  message,
  client,
  session,
  sessionkey,
  numero,
  msgBody,
  empresa,
  payload,
  responseDefault
}) {
  // Configurações da empresa
  const mensagemPadrao = typeof empresa?.mensagem_padrao === 'string' ? empresa.mensagem_padrao.trim() : '';
  const cooldownPadrao = Number.isInteger(empresa?.tempo_mensagem_padrao) ? empresa.tempo_mensagem_padrao : TEMPO_MENSAGEM_PADRAO_DEFAULT;

  // Helper para enviar mensagem padrão
  const enviarPadrao = (motivo, force = false) => sendDefault({
    client,
    session,
    sessionkey,
    numero,
    mensagemPadrao,
    cooldownPadrao,
    motivo,
    force
  });

  // Sequência de guards (ordem importa!)
  const guardSequence = [
    () => Guards.checkGroupMessage({ message }),
    () => Guards.checkCompanyEnabled({ empresa }),
    () => Guards.checkFirstContactToday({ session, sessionkey, numero }),
    () => Guards.checkIaEnabled({ empresa, sessionkey }),
    // Modo agente: a detecção de "quero falar com humano" mora no AGENTE
    // (detector melhor, pausa própria e registro do chamado no painel) — os
    // guards de cliente-pediu-humano só valem na rota OpenAI antiga.
    ...(globalThis.process.env.IA_PROVIDER === 'agente'
      ? []
      : [
          () => Guards.checkHumanRequest({ msgBody, session, sessionkey, numero }),
          () => Guards.checkClientRequestedHuman({ session, sessionkey, numero }),
        ]),
    () => Guards.checkRecentHuman({ session, sessionkey, numero }),
  ];

  // Executar guards em sequência
  for (const guard of guardSequence) {
    try {
      const result = await guard();
      console.log(`${LOG_PREFIX} Guard result: ${JSON.stringify(result)}`);
      if (result.shouldBlock) {
        console.log(`${LOG_PREFIX} ⛔ Guard bloqueou! Motivo: ${result.reason}`);
        // Caso especial: pedido de humano (envia mensagem específica)
        if (result.reason === 'pedido_humano' && result.transferMessage) {
          await MessageSender.sendText({ client, to: numero, text: result.transferMessage });
          await ChatHistoryHelper.registerAssistantMessage({
            session,
            sessionkey,
            numero,
            text: result.transferMessage,
            messageType: 'transferencia_humano',
          });
          await responseDefault(payload);
          return true; // processado
        }

        // Sempre manda msg padrão exceto para grupos
        if (result.reason !== 'grupo') {
          await enviarPadrao(result.reason);
        }

        await responseDefault(payload);
        return true; // processado (bloqueado por guard)
      }
    } catch (err) {
      customLogger.error(`${LOG_PREFIX} Erro em guard: ${err.message}`);
    }
  }

  // Se chegou aqui, todos os guards passaram -> processar IA
  return await processIA({
    message,
    client,
    session,
    sessionkey,
    numero,
    msgBody,
    empresa,
    payload,
    responseDefault,
    enviarPadrao
  });
}

async function processIA({
  message,
  client,
  session,
  sessionkey,
  numero,
  msgBody,
  empresa,
  payload,
  responseDefault,
  enviarPadrao
}) {
  try {
    // Cliente mandou áudio -> a resposta virá em voz: mostrar "gravando
    // áudio..."; texto -> "digitando...". Segura a expectativa nos turnos longos.
    if (message?.agenteAudioBase64) {
      await MessageSender.startRecording({ client, to: numero });
    } else {
      await MessageSender.startTyping({ client, to: numero });
    }

    // IA_PROVIDER=agente -> serviço do agente (Gemini/Vertex + MCP no GKE).
    // Qualquer outro valor mantém a rota OpenAI intacta (rollback = trocar env).
    let respostaIA;
    // globalThis.process: a funcao exportada deste modulo chama-se "process"
    // (linha 18) e SOMBREIA o global do Node — process.env aqui era a funcao,
    // .env dava undefined e TODA mensagem morria com "Cannot read properties
    // of undefined (reading 'IA_PROVIDER')" antes de chegar ao agente.
    if (globalThis.process.env.IA_PROVIDER === 'agente') {
      // Turno longo (pedido completo por áudio: ouvir + criar pedido + TTS)
      // não pode parecer travado: renova o chatstate a cada 20s (o WhatsApp
      // expira o "digitando..." sozinho em ~25s) e manda avisos de progresso
      // aos 30s e 65s — turno de áudio normal (9s + TTS ~10s) NÃO dispara
      // (aos 18s o aviso chegava colado na resposta, parecendo bug).
      const ehAudio = Boolean(message?.agenteAudioBase64);
      const renovarEstado = setInterval(() => {
        const mostrar = ehAudio ? MessageSender.startRecording : MessageSender.startTyping;
        mostrar({ client, to: numero });
      }, 20000);
      const avisosProgresso = [
        setTimeout(() => {
          MessageSender.sendText({ client, to: numero, text: 'Só um momento, estou montando tudo aqui… 😊' });
        }, 30000),
        setTimeout(() => {
          MessageSender.sendText({ client, to: numero, text: 'Quase pronto! Finalizando os últimos detalhes… 😉' });
        }, 65000),
      ];
      // WhatsApp novo esconde o telefone atrás de @lid — sem traduzir, o
      // pedido era gravado com o ID interno (caso real: #73067) e a loja não
      // conseguia ligar de volta. getContactById resolve LID -> número; se a
      // página do WA quebrar (o famoso "r"), segue sem — igual antes.
      let celularReal = null;
      if (String(numero).endsWith('@lid')) {
        // aceita só um telefone DIFERENTE do lid: getContactById devolvia o
        // próprio lid como "number" (15 dígitos passavam no filtro — pedido
        // #73072 saiu com o ID de novo). getContactLidAndPhone é a API certa.
        const validar = (bruto) => {
          const n = String(bruto || '').replace(/@.*$/, '').replace(/\D/g, '');
          return n.length >= 10 && !String(numero).includes(n) ? n : null;
        };
        try {
          if (typeof client?.getContactLidAndPhone === 'function') {
            const [r] = (await client.getContactLidAndPhone([numero])) || [];
            celularReal = validar(r?.pn);
          }
          if (!celularReal && typeof client?.getContactById === 'function') {
            const contato = await client.getContactById(numero);
            celularReal = validar(contato?.number);
          }
          if (!celularReal) customLogger.warning(`${LOG_PREFIX} lid sem telefone resolvível: ${numero}`);
        } catch (e) {
          customLogger.warning(`${LOG_PREFIX} lid->numero falhou: ${e.message}`);
        }
      }

      try {
        respostaIA = await AgenteClient.atender({
          sessionkey,
          numero,
          celular: celularReal,
          nome: message?.notifyName || message?.sender?.pushname || null,
          texto: msgBody,
          audioBase64: message?.agenteAudioBase64 || null,
          audioMime: message?.agenteAudioMime || null,
          // modo local: a config do agente pode vir da API da empresa (api_url
          // do DeviceCompany) — a máquina do lojista não precisa de .env
          apiUrlEmpresa: empresa?.api_url || null,
        });
      } finally {
        clearInterval(renovarEstado);
        avisosProgresso.forEach(clearTimeout);
      }
    } else {
      respostaIA = await EmpresaIA.processarMensagem({
        session,
        sessionkey,
        message,
        idprompt: empresa.idprompt || 'pmpt_697f8d2ca1c881948c3746f2ebeef2a30576966ac7b02dd3',
        vetor: empresa.vector_name || null,
      });
    }

    // AgenteClient devolve objeto {texto, audioBase64?}; EmpresaIA, string.
    const r = typeof respostaIA === 'string' ? { texto: respostaIA } : (respostaIA || null);

    // Cliente pediu atendente: manda um aviso pro PRÓPRIO número da loja
    // (conversa "Você" no WhatsApp) com o telefone clicável — quem está no
    // celular cai direto na conversa. Complementa o sino do painel web.
    if (r?.motivo === 'pedido_humano') {
      try {
        const donoWid = client?.info?.wid?._serialized;
        if (donoWid) {
          const foneCliente = (typeof celularReal !== 'undefined' && celularReal)
            ? celularReal
            : String(numero).replace(/@.*$/, '');
          const aviso = [
            '🔔 *Cliente pediu atendimento humano!*',
            `📱 wa.me/${foneCliente.length <= 11 ? '55' + foneCliente : foneCliente}`,
            `💬 "${String(msgBody || '').slice(0, 120)}"`,
            '',
            '_Toque no link para abrir a conversa. O bot já pausou para este cliente._',
          ].join('\n');
          await MessageSender.sendText({ client, to: donoWid, text: aviso });
        }
      } catch (e) {
        customLogger.warning(`${LOG_PREFIX} aviso à loja falhou: ${e.message}`);
      }
    }

    if (r?.texto) {
      // Registrar resposta da IA no cache (evitar loop no self-test)
      registerIAResponse(r.texto);

      await MessageSender.stopTyping({ client, to: numero });
      // Cliente falou por áudio -> agente pode responder em áudio (TTS).
      // PTT falhou (engine/codec)? Texto salva a conversa.
      let enviado = false;
      if (r.audioBase64) {
        enviado = await MessageSender.sendPtt({
          client,
          to: numero,
          base64: r.audioBase64,
          mimetype: r.audioMime || 'audio/ogg; codecs=opus',
        });
      }
      if (!enviado) {
        await MessageSender.sendText({ client, to: numero, text: r.texto });
      }
      await ChatHistoryHelper.registerAssistantMessage({
        session,
        sessionkey,
        numero,
        text: r.texto,
        messageType: 'ia',
      });
      customLogger.info(`${LOG_PREFIX} Resposta IA enviada`, { session, numero });
    } else {
      await MessageSender.stopTyping({ client, to: numero });
      await enviarPadrao('ia_sem_resposta');
    }
  } catch (error) {
    customLogger.error(`${LOG_PREFIX} Erro ao processar IA`, error?.stack || error?.message || error);
    await MessageSender.stopTyping({ client, to: numero });
    await enviarPadrao('erro_ia');
  }

  await responseDefault(payload);
  return true;
}

module.exports = { process };
