const ChatHistoryHelper = require('../events/chatHistory');
const customLogger = require('../../../util/customLogger');
const { TEMPO_MENSAGEM_PADRAO_DEFAULT, LOG_PREFIX } = require('./iaConfig');

async function sendDefault({
  client,
  session,
  sessionkey,
  numero,
  mensagemPadrao,
  cooldownPadrao,
  motivo,
  force = false
}) {
  if (!mensagemPadrao) return false;

  try {
    if (!force) {
      const jaEnviouHoje = await ChatHistoryHelper.jaEnvieiMensagemPadraoHoje({ session, sessionkey, numero });
      console.log('ja enviou hoje?', jaEnviouHoje);
      if (jaEnviouHoje) return false;
    }

    let sent = false;
    try {
      const sender = require('../events/messageSender');
      sent = await sender.sendText({ client, to: numero, text: mensagemPadrao });
    } catch (_) {
      if (client) {
        if (typeof client.sendText === 'function') {
          await client.sendText(numero, mensagemPadrao);
          sent = true;
        } else if (typeof client.sendMessage === 'function') {
          await client.sendMessage(numero, mensagemPadrao);
          sent = true;
        }
      }
    }

    if (!sent) return false;

    await ChatHistoryHelper.registerAssistantMessage({
      session,
      sessionkey,
      numero,
      text: mensagemPadrao,
      messageType: 'mensagem_padrao',
    });
    customLogger.info(`${LOG_PREFIX} Mensagem padrao enviada`, { session, numero, motivo, force });
    return true;
  } catch (err) {
    customLogger.error(`${LOG_PREFIX} Erro ao enviar mensagem padrão`, err.message || err);
    return false;
  }
}

module.exports = { sendDefault };
