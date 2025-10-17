const Guards = require('./guards');
const { sendDefault } = require('./defaultMessageService');
const EmpresaIA = require('./empresaIA');
const MessageSender = require('../events/messageSender');
const ChatHistoryHelper = require('../events/chatHistory');
const customLogger = require('../../../util/customLogger');
const { TEMPO_MENSAGEM_PADRAO_DEFAULT, LOG_PREFIX } = require('./iaConfig');

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
  // Configurações da empresa
  const mensagemPadrao = typeof empresa?.mensagem_padrao === 'string' ? empresa.mensagem_padrao.trim() : '';
  const cooldownPadrao = Number.isInteger(empresa?.tempo_mensagem_padrao) ? empresa.tempo_mensagem_padrao : TEMPO_MENSAGEM_PADRAO_DEFAULT;

  customLogger.debug(`${LOG_PREFIX} Iniciando Decision Engine para ${numero}`);    
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
    () => Guards.checkIaEnabled({ empresa }),
    () => Guards.checkHumanRequest({ msgBody, session, sessionkey, numero }),
    () => Guards.checkRecentHuman({ session, sessionkey, numero }),
    () => Guards.checkClientRequestedHuman({ session, sessionkey, numero }),
    //() => Guards.checkIaCooldown({ session, sessionkey, numero }),
    //() => Guards.checkTrigger({ msgBody })
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

        // sempre manda msg padrão se 
        if (result.reason != 'grupo') await enviarPadrao(result.reason);

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
    await MessageSender.startTyping({ client, to: numero });

    const respostaIA = await EmpresaIA.processarMensagem({
      session,
      sessionkey,
      message,
      idprompt: empresa.idprompt || 'pmpt_6868664894508195845bb4e01bebf8ed0f5f43edbfd62fee',
      vetor: empresa.vector_name || null,
    });

    if (respostaIA) {
      await MessageSender.stopTyping({ client, to: numero });
      await MessageSender.sendText({ client, to: numero, text: respostaIA });
      await ChatHistoryHelper.registerAssistantMessage({
        session,
        sessionkey,
        numero,
        text: respostaIA,
        messageType: 'ia',
      });
      customLogger.info(`${LOG_PREFIX} Resposta IA enviada`, { session, numero });
    } else {
      await MessageSender.stopTyping({ client, to: numero });
      await enviarPadrao('ia_sem_resposta');
    }
  } catch (error) {
    customLogger.error(`${LOG_PREFIX} Erro ao processar IA`, error?.message || error);
    await MessageSender.stopTyping({ client, to: numero });
    await enviarPadrao('erro_ia');
  }

  await responseDefault(payload);
  return true;
}

module.exports = { process };
