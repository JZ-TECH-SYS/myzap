const ChatHistoryHelper = require('../events/chatHistory');
const customLogger = require('../../../util/customLogger');
const { registerIAResponse } = require('./iaResponseCache');
const { LOG_PREFIX } = require('./iaConfig');

/**
 * Envia mensagem padrão para o cliente
 * @param {Object} params
 * @param {Object} params.client - Cliente WhatsApp
 * @param {string} params.session - ID da sessão
 * @param {string} params.sessionkey - Chave da sessão
 * @param {string} params.numero - Número do cliente
 * @param {string} params.mensagemPadrao - Texto da mensagem padrão
 * @param {string} params.motivo - Motivo do envio
 * @param {boolean} params.force - Forçar envio mesmo se já enviou hoje
 * @returns {Promise<boolean>} true se enviou com sucesso
 */
async function sendDefault({
  client,
  session,
  sessionkey,
  numero,
  mensagemPadrao,
  motivo,
  force = false
}) {
  if (!mensagemPadrao) {
    return false;
  }

  try {
    if (!force) {
      const jaEnviouHoje = await ChatHistoryHelper.jaEnvieiMensagemPadraoHoje({ session, sessionkey, numero });
      if (jaEnviouHoje) {
        return false;
      }
    }

    const sender = require('../events/messageSender');
    
    // Registrar mensagem padrão no cache (evitar loop no self-test)
    registerIAResponse(mensagemPadrao);
    
    const sent = await sender.sendText({ client, to: numero, text: mensagemPadrao });
    
    if (!sent) return false;

    await ChatHistoryHelper.registerAssistantMessage({
      session,
      sessionkey,
      numero,
      text: mensagemPadrao,
      messageType: 'mensagem_padrao',
    });
    
    customLogger.info(`${LOG_PREFIX} Mensagem padrao enviada`, { session, numero, motivo });
    return true;
  } catch (err) {
    customLogger.error(`${LOG_PREFIX} Erro ao enviar mensagem padrão`, err.message || err);
    return false;
  }
}

module.exports = { sendDefault };
