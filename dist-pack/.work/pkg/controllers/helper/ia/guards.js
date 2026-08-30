const ChatHistoryHelper = require('../events/chatHistory');
const HumanDetector = require('./humanDetector');
const { HUMAN_PAUSE_MINUTES } = require('./iaConfig');

/**
 * Guards/validações para decidir se deve processar IA ou enviar mensagem padrão.
 * Cada função retorna { shouldBlock: boolean, reason?: string }
 */

async function checkGroupMessage({ message }) {
  // Verifica se é grupo por múltiplos métodos:
  // 1. Propriedade isGroupMsg (WPPConnect/Venom)
  // 2. Sufixo @g.us no campo 'from' (whatsapp-web.js)
  const isGroup = message.isGroupMsg || (message.from && message.from.endsWith('@g.us'));
  
  console.log('[GUARD] checkGroupMessage - isGroupMsg:', message.isGroupMsg, 'from:', message.from, 'isGroup:', isGroup);
  
  if (isGroup) {
    console.log('🚫 [GUARD] Bloqueando mensagem de grupo!');
    return { shouldBlock: true, reason: 'grupo' };
  }
  return { shouldBlock: false };
}

async function checkCompanyEnabled({ empresa }) {
  if (!empresa) {
    return { shouldBlock: true, reason: 'empresa_nao_encontrada' };
  }
  return { shouldBlock: false };
}

async function checkIaEnabled({ empresa }) {
  const iaAtiva = empresa.ia_ativa !== false;
  if (!iaAtiva) {
    return { shouldBlock: true, reason: 'ia_desligada' };
  }
  return { shouldBlock: false };
}

async function checkHumanRequest({ msgBody, session, sessionkey, numero }) {
  if (msgBody && HumanDetector.detectarPedidoHumano(msgBody)) {
    // Marcar pedido de humano no histórico
    await ChatHistoryHelper.marcarPedidoHumano({ session, sessionkey, numero });
    return { 
      shouldBlock: true, 
      reason: 'pedido_humano',
      transferMessage: HumanDetector.getMensagemTransferencia()
    };
  }
  return { shouldBlock: false };
}

async function checkRecentHuman({ session, sessionkey, numero }) {
  // Se ALLOW_SELF_TEST está ativo, ignorar verificação de agente recente
  // Isso permite testar a IA enviando mensagem para o próprio número
  if (process.env.ALLOW_SELF_TEST === 'true') {
    return { shouldBlock: false };
  }
  
  const humanoFalou = await ChatHistoryHelper.humanoFalouRecentemente({
    session,
    sessionkey,
    numero,
    minutos: HUMAN_PAUSE_MINUTES,
  });
  
  if (humanoFalou) {
    return { shouldBlock: true, reason: 'agente_recente' };
  }
  return { shouldBlock: false };
}

async function checkClientRequestedHuman({ session, sessionkey, numero }) {
  const clientePediuHumano = await ChatHistoryHelper.clientePediuHumano({
    session,
    sessionkey,
    numero,
    minutos: 60
  });
  
  if (clientePediuHumano) {
    return { shouldBlock: true, reason: 'aguardando_humano' };
  }
  return { shouldBlock: false };
}

/**
 * Verifica se é o primeiro contato do dia com este número.
 * Se for, bloqueia para enviar mensagem padrão antes da IA.
 * @param {Object} params
 * @param {string} params.session - ID da sessão
 * @param {string} params.sessionkey - Chave da sessão  
 * @param {string} params.numero - Número do cliente
 * @returns {Promise<{shouldBlock: boolean, reason?: string}>}
 */
async function checkFirstContactToday({ session, sessionkey, numero }) {
  const jaInteragiuHoje = await ChatHistoryHelper.jaInteragiuHoje({
    session,
    sessionkey,
    numero,
  });
  
  if (!jaInteragiuHoje) {
    return { shouldBlock: true, reason: 'primeiro_contato' };
  }
  return { shouldBlock: false };
}

module.exports = {
  checkGroupMessage,
  checkCompanyEnabled,
  checkIaEnabled,
  checkHumanRequest,
  checkRecentHuman,
  checkClientRequestedHuman,
  checkFirstContactToday,
};
