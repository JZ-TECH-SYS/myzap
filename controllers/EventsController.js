'use strict';

const eventsHelper = require('./helper/events/events.js');
const ChatHistoryHelper = require('./helper/events/chatHistory.js');

// 🔄 Pipeline e helpers especializados
const ContextBuilder = require('./helper/ia/contextBuilder.js');
const AudioProcessor = require('./helper/ia/audioProcessor.js');
const DecisionEngine = require('./helper/ia/decisionEngine.js');
const SocketWebhookManager = require('./helper/events/socketWebhookManager.js');
const OutboundMessageProcessor = require('./helper/events/outboundMessageProcessor.js');
const StatusAckManager = require('./helper/events/statusAckManager.js');
const ConnectionStateManager = require('./helper/events/connectionStateManager.js');
const customLogger = require('../util/customLogger.js');

// 🔍 Health Check - Registrar quando mensagens são recebidas
const { registerMessageReceived } = require('../jobs/sessionHealthCheck.js');

// 🛡️ Cache de deduplicação de mensagens (evita processar mesma msg 2x)
const processedMessages = new Map();
const DEDUP_TTL_MS = 30000; // 30 segundos
const DEDUP_CLEANUP_INTERVAL = 60000; // Limpar a cada 1 minuto

// Limpar cache de deduplicação periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [msgId, timestamp] of processedMessages.entries()) {
    if (now - timestamp > DEDUP_TTL_MS) {
      processedMessages.delete(msgId);
    }
  }
}, DEDUP_CLEANUP_INTERVAL);

module.exports = class Events {
  /**
   * Configura listeners de mensagens baseado na engine
   */
  static async receiveMessage(session, client, req) {
    if (typeof client?.onAnyMessage === 'function') {
      // WPPConnect & Venom
      client.onAnyMessage(async message => {
        // 🔍 Registrar mensagem para health check
        registerMessageReceived(session);
        await this.processMessage(message, session, client, req);
      });
    } else if (typeof client?.on === 'function') {
      // WhatsApp Web.js
      client.on('message', async (message) => {
        if (message.from === 'status@broadcast') return;
        // 🔍 Registrar mensagem para health check
        registerMessageReceived(session);
        await this.processMessage(message, session, client, req);
      });
    }
  }

  /**
   * Pipeline principal de processamento de mensagens
   */
  static async processMessage(message, session, client, req) {
    // 🛡️ Deduplicação: extrair ID único da mensagem
    const msgId = message.id?._serialized || message.id?.id || message.id || `${message.from}-${message.timestamp}`;
    
    // Verificar se já processamos esta mensagem
    if (processedMessages.has(msgId)) {
      customLogger.debug(`[DEDUP] Mensagem ${msgId} já processada, ignorando duplicata`);
      return;
    }
    
    // Marcar como processada ANTES de iniciar o processamento
    processedMessages.set(msgId, Date.now());
    
    // Gerenciador de comunicação socket/webhook
    customLogger.debug(`[IA] processMessage chamada para sessão ${session}`);
    console.log(`[DEBUG] Message isGroupMsg: ${message.isGroupMsg}, from: ${message.from}, type: ${message.type}`);
    
    const socketManager = new SocketWebhookManager(req, session);

    // Construir contexto da mensagem (usar payload mutável)
    const ctx = await ContextBuilder.build({ message, session, client, req });
    const { sessionkey, numero, msgBody, empresa } = ctx;
    let payload = ctx.payload; // será atualizado se áudio transcrever

    // 1. Filtrar tipos não permitidos
    if (!eventsHelper.isPermitido(message)) {
      return socketManager.responseDefault(payload);
    }

    // 2. Processar mensagens enviadas pelo próprio bot
    if (message.fromMe) {
      await socketManager.notifyMessageSent(payload);
      await OutboundMessageProcessor.processFromMe({
        message, session, sessionkey, numero, socketManager
      });
      return;
    }

    // 3. Notificar recebimento de mensagem
    await socketManager.notifyMessageReceived(payload);

    // 4. Processar áudio se necessário (só se IA ativa)
    
    const audioResult = await AudioProcessor.processAudio({
      message, client, numero, payload, session, sessionkey, empresa
    });
    console.log('process audio', audioResult);
    if (!audioResult.success) {
      await socketManager.responseDefault(payload);
      return;
    }

    // Aplicar modificações do áudio
    if (audioResult.message) message = audioResult.message;
    if (audioResult.payload) payload = audioResult.payload;

    // 5. Registrar mensagem do usuário
    const plainBody = typeof message.body === 'string' ? message.body.trim() : '';
    if (plainBody) {
      await ChatHistoryHelper.registerUserMessage({ session, sessionkey, numero, text: plainBody });
    }


    customLogger.debug(`[IA] Mensagem de ${numero}: ${plainBody}`);
    // 6. Engine de decisão IA
    await DecisionEngine.process({
      message,
      client,
      session,
      sessionkey,
      numero,
      msgBody: plainBody,
      empresa,
      payload,
      responseDefault: (payload) => socketManager.responseDefault(payload)
    });
  }

  /**
   * Configura listeners de status de mensagens (ACK)
   */
  static statusMessage(session, client, req) {
    const socketManager = new SocketWebhookManager(req, session);
    StatusAckManager.setupMessageStatus(session, client, req, socketManager);
  }

  /**
   * Emite status simples via Socket.IO
   */
  static StatusMessage(req, status, session) {
    StatusAckManager.emitStatus(req, status, session);
  }

  /**
   * Configura listeners de mudança de estado de conexão
   */
  static async statusConnection(session, client, req) {
    ConnectionStateManager.setupStateChange(session, client, req);
  }
};






