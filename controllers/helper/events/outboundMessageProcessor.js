const ChatHistoryHelper = require('./chatHistory.js');
const { isIAResponse, isSystemMedia } = require('../ia/iaResponseCache');
const customLogger = require('../../../util/customLogger.js');
const { LOG_PREFIX } = require('../ia/iaConfig.js');

/**
 * Helper para processar mensagens enviadas pelo próprio bot
 * Detecta ecos, registra mensagens de agentes humanos
 */
class OutboundMessageProcessor {
  
  static async processFromMe({ message, session, sessionkey, numero, socketManager, empresa = null }) {
    const outboundText = typeof message.body === 'string' ? message.body.trim() : '';
    const TIPOS_MIDIA = ['ptt', 'audio', 'image', 'video', 'document', 'sticker'];
    const temMidia = Boolean(message.hasMedia) || TIPOS_MIDIA.includes(String(message.type || ''));

    if (!outboundText) {
      // Áudio/foto/figurinha sem texto: se o SISTEMA não mandou mídia para
      // este cliente há pouco (voz do bot, anexo, PDF pela API), foi o
      // atendente pelo celular — caso real: o Vaqueiro respondeu por áudio e
      // o bot seguiu falando por cima (Leticia, 06/09/2026).
      if (!temMidia || isSystemMedia(session, numero)) {
        return { processed: true, humano: false };
      }
      const rotulo = `[${String(message.type || 'mídia')} do atendente]`;
      await ChatHistoryHelper.registerAgentMessage({ session, sessionkey, numero, text: rotulo });
      customLogger.info(`${LOG_PREFIX} Agent media detected`, { session, numero, tipo: message.type });
      if (globalThis.process.env.IA_PROVIDER === 'agente') {
        const AgenteClient = require('../ia/agenteClient');
        AgenteClient.atender({ sessionkey, numero, texto: rotulo, origem: 'humano', apiUrlEmpresa: empresa?.api_url || null })
          .catch((err) => customLogger.warning(`${LOG_PREFIX} contexto humano não chegou ao agente: ${err.message}`));
      }
      return { processed: true, humano: true };
    }

    // Eco do bot (mesmo número + mesmo texto) ou texto que saiu pelo sistema
    // (resposta da IA, mensagem padrão, confirmação de pedido/NF-e enviada
    // pela API do ClickExpress): não é o atendente digitando.
    const isEcho = await ChatHistoryHelper.isRecentAssistantEcho({
      session,
      sessionkey,
      numero,
      text: outboundText,
    });
    if (isEcho || isIAResponse(outboundText)) {
      return { processed: true, humano: false };
    }

    // Atendente humano digitou: registra (pausa a IA por HUMAN_PAUSE_MINUTES
    // para este cliente) e manda o texto ao agente só como contexto — ele não
    // responde, apenas guarda, para retomar a conversa sabendo o que foi dito.
    await ChatHistoryHelper.registerAgentMessage({
      session,
      sessionkey,
      numero,
      text: outboundText
    });
    customLogger.info(`${LOG_PREFIX} Agent reply detected`, { session, numero });

    if (globalThis.process.env.IA_PROVIDER === 'agente') {
      const AgenteClient = require('../ia/agenteClient');
      AgenteClient.atender({
        sessionkey,
        numero,
        texto: outboundText,
        origem: 'humano',
        apiUrlEmpresa: empresa?.api_url || null,
      }).catch((err) => customLogger.warning(`${LOG_PREFIX} contexto humano não chegou ao agente: ${err.message}`));
    }

    return { processed: true, humano: true };
  }
}

module.exports = OutboundMessageProcessor;
