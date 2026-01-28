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

module.exports = class Events {
  /**
   * Configura listeners de mensagens baseado na engine
   */
  static async receiveMessage(session, client, req) {
    console.log(`[DEBUG] Configurando receiveMessage para sessão ${session}`);
    if (typeof client?.onAnyMessage === 'function') {
      // WPPConnect & Venom
      client.onAnyMessage(async message => {
        await this.processMessage(message, session, client, req);
      });
    } else if (typeof client?.on === 'function') {
      // WhatsApp Web.js - usando message_create como fallback
      console.log(`[DEBUG] Registrando listeners para ${session}`);
      
      // Evento message (mensagens recebidas)
      client.on('message', async (message) => {
        console.log(`[🔔 MESSAGE] ${session}: ${message.from} → ${message.body?.substring(0, 50)}`);
        await this.processMessage(message, session, client, req);
      });
      
      // Evento message_create (TODAS as mensagens - enviadas e recebidas)
      // Usado como fallback caso 'message' não dispare
      client.on('message_create', async (message) => {
        console.log(`[🔔 MESSAGE_CREATE] ${session}: fromMe=${message.fromMe} from=${message.from} → ${message.body?.substring(0, 50)}`);
        // Só processar se NÃO for do próprio bot e se o evento 'message' não disparou
        if (!message.fromMe) {
          // Verificar se já foi processado pelo evento 'message'
          const msgId = message.id?._serialized || message.id?.id;
          if (!this._processedMessages) this._processedMessages = new Set();
          if (this._processedMessages.has(msgId)) {
            console.log(`[SKIP] Mensagem ${msgId} já processada`);
            return;
          }
          this._processedMessages.add(msgId);
          // Limpar mensagens antigas (manter últimas 100)
          if (this._processedMessages.size > 100) {
            const arr = Array.from(this._processedMessages);
            this._processedMessages = new Set(arr.slice(-50));
          }
          await this.processMessage(message, session, client, req);
        }
      });
      
      // Verificar listeners registrados
      console.log(`[DEBUG] Listeners 'message': ${client.listenerCount('message')}`);
      console.log(`[DEBUG] Listeners 'message_create': ${client.listenerCount('message_create')}`);
    }
  }

  /**
   * Pipeline principal de processamento de mensagens
   */
  static async processMessage(message, session, client, req) {
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






