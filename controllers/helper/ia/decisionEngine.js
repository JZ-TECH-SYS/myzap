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
  
  // Evitar race condition: se já tem mensagem sendo processada para este número, ignorar
  if (!processingLock.acquire({ session, sessionkey, numero })) {
    customLogger.debug(`${LOG_PREFIX} Lock ativo para ${numero}, ignorando mensagem duplicada`);
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
    () => Guards.checkHumanRequest({ msgBody, session, sessionkey, numero }),
    () => Guards.checkRecentHuman({ session, sessionkey, numero }),
    () => Guards.checkClientRequestedHuman({ session, sessionkey, numero }),
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
      respostaIA = await AgenteClient.atender({
        sessionkey,
        numero,
        nome: message?.notifyName || message?.sender?.pushname || null,
        texto: msgBody,
        audioBase64: message?.agenteAudioBase64 || null,
        audioMime: message?.agenteAudioMime || null,
        // modo local: a config do agente pode vir da API da empresa (api_url do
        // DeviceCompany) — a máquina do lojista não precisa de .env
        apiUrlEmpresa: empresa?.api_url || null,
      });
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
