const ChatHistoryHelper = require('../events/chatHistory');
const customLogger = require('../../../util/customLogger');
const { registerIAResponse } = require('./iaResponseCache');
const { LOG_PREFIX } = require('./iaConfig');
const { buscarAnexosPadrao, mimeDoAnexo } = require('./anexosPadrao');

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
 * @param {string|null} [params.apiUrlEmpresa] - api_url da empresa (base para buscar os anexos)
 * @returns {Promise<boolean>} true se enviou com sucesso
 */
async function sendDefault({
  client,
  session,
  sessionkey,
  numero,
  mensagemPadrao,
  motivo,
  force = false,
  apiUrlEmpresa = null
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

    await enviarAnexos({ client, sessionkey, numero, apiUrlEmpresa, sender });
    return true;
  } catch (err) {
    customLogger.error(`${LOG_PREFIX} Erro ao enviar mensagem padrão`, err.message || err);
    return false;
  }
}

/**
 * Fotos/PDF configurados no painel saem logo depois do texto — só com a loja
 * aberta (a API decide). Um anexo que falhar não derruba os outros nem o
 * fluxo: o cliente já recebeu a mensagem padrão.
 */
async function enviarAnexos({ client, sessionkey, numero, apiUrlEmpresa, sender }) {
  const { aberto, anexos } = await buscarAnexosPadrao({ sessionkey, apiUrlEmpresa });
  if (!aberto || !anexos.length) return 0;

  let enviados = 0;
  for (const anexo of anexos) {
    const ok = await sender.sendFileFromUrl({
      client,
      to: numero,
      url: anexo.url,
      filename: anexo.nome,
      mimetype: mimeDoAnexo(anexo),
    });
    if (ok) enviados += 1;
  }
  customLogger.info(`${LOG_PREFIX} Anexos da mensagem padrao`, { numero, enviados, total: anexos.length });
  return enviados;
}

module.exports = { sendDefault, enviarAnexos };
