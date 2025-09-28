const ChatHistoryHelper = require('../events/chatHistory');
const TriggersHelper = require('../events/triggers');
const HumanDetector = require('./humanDetector');
const { IA_COOLDOWN_SECONDS, HUMAN_PAUSE_MINUTES } = require('./iaConfig');

/**
 * Guards/validações para decidir se deve processar IA ou enviar mensagem padrão.
 * Cada função retorna { shouldBlock: boolean, reason?: string }
 */

async function checkGroupMessage({ message }) {
  if (message.isGroupMsg) {
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

async function checkIaCooldown({ session, sessionkey, numero }) {
  const iaEmCooldown = await ChatHistoryHelper.emCooldownDeIA({
    session,
    sessionkey,
    numero,
    segundos: IA_COOLDOWN_SECONDS,
  });
  
  if (iaEmCooldown) {
    return { shouldBlock: true, reason: 'ia_em_cooldown' };
  }
  return { shouldBlock: false };
}

async function checkTrigger({ msgBody }) {
  const gatilhoIA = TriggersHelper.necessitaIA(msgBody);
  if (!gatilhoIA) {
    return { shouldBlock: true, reason: 'gatilho_nao_acionado' };
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
  checkIaCooldown,
  checkTrigger
};
