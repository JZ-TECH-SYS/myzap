"use strict";

const eventsHelper = require("./helper/events/events.js");
const ChatHistoryHelper = require("./helper/events/chatHistory.js");
const ContextBuilder = require("./helper/ia/contextBuilder.js");
const AudioProcessor = require("./helper/ia/audioProcessor.js");
const DecisionEngine = require("./helper/ia/decisionEngine.js");
const SocketWebhookManager = require("./helper/events/socketWebhookManager.js");
const OutboundMessageProcessor = require("./helper/events/outboundMessageProcessor.js");
const StatusAckManager = require("./helper/events/statusAckManager.js");
const ConnectionStateManager = require("./helper/events/connectionStateManager.js");
const customLogger = require("../util/customLogger.js");
const {
  registerIAResponse,
  isIAResponse,
} = require("./helper/ia/iaResponseCache.js");

/**
 * Controlador de eventos do WhatsApp.
 * Gerencia recebimento, processamento e envio de mensagens.
 */
module.exports = class Events {
  static registerIAResponse = registerIAResponse;

  /**
   * Configura listeners de mensagens baseado na engine.
   * @param {string} session - ID da sessão
   * @param {Object} client - Cliente WhatsApp (whatsapp-web.js, WPPConnect ou Venom)
   * @param {Object} req - Request do Express
   */
  static async receiveMessage(session, client, req) {
    if (typeof client?.onAnyMessage === "function") {
      // WPPConnect & Venom
      client.onAnyMessage(async (message) => {
        await this.processMessage(message, session, client, req);
      });
    } else if (typeof client?.on === "function") {
      // WhatsApp Web.js - usando APENAS message_create (captura todas as mensagens)
      client.on("message_create", async (message) => {
        // Dedupe: evitar processar mesma mensagem 2x
        const msgId = message.id?._serialized || message.id?.id;
        if (!this._processedMessages) this._processedMessages = new Set();
        if (this._processedMessages.has(msgId)) {
          return;
        }
        this._processedMessages.add(msgId);
        if (this._processedMessages.size > 100) {
          const arr = Array.from(this._processedMessages);
          this._processedMessages = new Set(arr.slice(-50));
        }

        const allowSelfTest = process.env.ALLOW_SELF_TEST === "true";

        // Se for mensagem própria
        if (message.fromMe) {
          // Em modo self-test, verificar se é resposta da IA (evitar loop)
          if (allowSelfTest && isIAResponse(message.body)) {
            return;
          }
          // Fora do self-test, ignorar mensagens próprias
          if (!allowSelfTest) {
            await this.processMessage(message, session, client, req);
            return;
          }
        }

        await this.processMessage(message, session, client, req);
      });
    }
  }

  /**
   * Pipeline principal de processamento de mensagens.
   * @param {Object} message - Objeto da mensagem recebida
   * @param {string} session - ID da sessão
   * @param {Object} client - Cliente WhatsApp
   * @param {Object} req - Request do Express
   */
  static async processMessage(message, session, client, req) {
    const socketManager = new SocketWebhookManager(req, session);

    // Construir contexto da mensagem
    const ctx = await ContextBuilder.build({ message, session, client, req });
    const { sessionkey, numero, empresa } = ctx;
    let payload = ctx.payload;

    // 1. Filtrar tipos não permitidos
    if (!eventsHelper.isPermitido(message)) {
      return socketManager.responseDefault(payload);
    }

    // 2. Processar mensagens enviadas pelo próprio bot
    const allowSelfTest = process.env.ALLOW_SELF_TEST === "true";
    if (message.fromMe) {
      await socketManager.notifyMessageSent(payload);
      await OutboundMessageProcessor.processFromMe({
        message,
        session,
        sessionkey,
        numero,
        socketManager,
      });

      if (!allowSelfTest) {
        return;
      }
    }

    // 3. Notificar recebimento de mensagem
    await socketManager.notifyMessageReceived(payload);

    // 4. Processar áudio se necessário
    const audioResult = await AudioProcessor.processAudio({
      message,
      client,
      numero,
      payload,
      session,
      sessionkey,
      empresa,
    });
    if (!audioResult.success) {
      await socketManager.responseDefault(payload);
      return;
    }

    if (audioResult.message) message = audioResult.message;
    if (audioResult.payload) payload = audioResult.payload;

    // 5. Registrar mensagem do usuário
    const plainBody =
      typeof message.body === "string" ? message.body.trim() : "";
    if (plainBody) {
      await ChatHistoryHelper.registerUserMessage({
        session,
        sessionkey,
        numero,
        text: plainBody,
      });
    }

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
      responseDefault: (p) => socketManager.responseDefault(p),
    });
  }

  /**
   * Configura listeners de status de mensagens (ACK).
   * @param {string} session - ID da sessão
   * @param {Object} client - Cliente WhatsApp
   * @param {Object} req - Request do Express
   */
  static statusMessage(session, client, req) {
    const socketManager = new SocketWebhookManager(req, session);
    StatusAckManager.setupMessageStatus(session, client, req, socketManager);
  }

  /**
   * Emite status simples via Socket.IO.
   * @param {Object} req - Request do Express
   * @param {string} status - Status a emitir
   * @param {string} session - ID da sessão
   */
  static StatusMessage(req, status, session) {
    StatusAckManager.emitStatus(req, status, session);
  }

  /**
   * Configura listeners de mudança de estado de conexão.
   * @param {string} session - ID da sessão
   * @param {Object} client - Cliente WhatsApp
   * @param {Object} req - Request do Express
   */
  static async statusConnection(session, client, req) {
    ConnectionStateManager.setupStateChange(session, client, req);
  }
};
