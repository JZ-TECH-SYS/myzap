const ChatHistoryHelper = require('../controllers/helper/events/chatHistory');
const customLogger = require('../util/customLogger');

let intervalHandle = null;

/**
 * 🚀 Job de limpeza automática do histórico de chat
 * Remove mensagens antigas do banco de dados
 */
function startChatHistoryCleanupJob() {
  const diasRetencao = parseInt(process.env.CHAT_HISTORY_RETENTION_DAYS, 10) || 30;
  
  // Calcular próxima execução às 3h da madrugada
  const now = new Date();
  const targetTime = new Date();
  targetTime.setHours(3, 0, 0, 0);
  
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const initialDelay = targetTime - now;
  
  setTimeout(() => {
    executarLimpeza(diasRetencao);
    
    // Agendar execução diária
    intervalHandle = setInterval(() => {
      executarLimpeza(diasRetencao);
    }, 24 * 60 * 60 * 1000);
    
    if (typeof intervalHandle.unref === 'function') {
      intervalHandle.unref();
    }
  }, initialDelay);
  
  customLogger.info(`[CHAT HISTORY CLEANUP] Job agendado para 3h (retenção: ${diasRetencao} dias)`);
}

async function executarLimpeza(diasRetencao) {
  try {
    customLogger.info('[CHAT HISTORY CLEANUP] Iniciando limpeza...');
    const deleted = await ChatHistoryHelper.cleanupOldMessages({ diasRetencao });
    customLogger.success(`[CHAT HISTORY CLEANUP] ${deleted} registros removidos`);
  } catch (err) {
    customLogger.error(`[CHAT HISTORY CLEANUP] Erro: ${err.message}`);
  }
}

module.exports = { startChatHistoryCleanupJob };
