const ChatHistoryHelper = require('./chatHistory.js');
const customLogger = require('../../../util/customLogger.js');
const { LOG_PREFIX } = require('../ia/iaConfig.js');

/**
 * Helper para processar mensagens enviadas pelo próprio bot
 * Detecta ecos, registra mensagens de agentes humanos
 */
class OutboundMessageProcessor {
  
  static async processFromMe({ message, session, sessionkey, numero, socketManager }) {
    const outboundText = typeof message.body === 'string' ? message.body.trim() : '';
    
    // Verificar se é eco recente (evita loops)
    const isEcho = await ChatHistoryHelper.isRecentAssistantEcho({
      session,
      sessionkey,
      numero,
      text: outboundText,
    });

    // Se não é eco e tem texto, registrar como mensagem de agente humano
    if (!isEcho && outboundText) {
      await ChatHistoryHelper.registerAgentMessage({ 
        session, 
        sessionkey, 
        numero, 
        text: outboundText 
      });
      customLogger.info(`${LOG_PREFIX} Agent reply detected`, { session, numero });
    }

    return { processed: true };
  }
}

module.exports = OutboundMessageProcessor;
