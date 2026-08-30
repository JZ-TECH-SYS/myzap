const webhooks = require('../WebhooksController.js');
const customLogger = require('../../util/customLogger.js');

/**
 * Helper para gerenciar comunicação via sockets e webhooks
 * Centraliza todas as interações de rede/eventos externos
 */
class SocketWebhookManager {
  constructor(req, session) {
    this.funcoesSocket = req.funcoesSocket;
    this.session = session;
    this.webhooks = webhooks;
  }

  /**
   * Resposta padrão: webhook + socket events
   */
  async responseDefault(payload) {
    await this.webhooks?.wh_messages(this.session, payload);
    
    if (this.funcoesSocket && typeof this.funcoesSocket.events === 'function') {
      this.funcoesSocket.events(this.session, payload.message || payload);
    } else {
      customLogger.info(`⚠️ [${this.session}] funcoesSocket.events não disponível`);
    }
  }

  /**
   * Notificar mensagem enviada pelo bot
   */
  async notifyMessageSent(payload) {
    if (this.funcoesSocket && typeof this.funcoesSocket.messagesent === 'function') {
      this.funcoesSocket.messagesent(this.session, payload);
    }
    await this.webhooks?.wh_messages(this.session, payload);
  }

  /**
   * Notificar nova mensagem recebida
   */
  async notifyMessageReceived(payload) {
    try {
      if (this.funcoesSocket && typeof this.funcoesSocket.message === 'function') {
        this.funcoesSocket.message(this.session, payload);
      } else {
        customLogger.info(`⚠️ [${this.session}] funcoesSocket.message não disponível`);
      }
    } catch (err) {
      customLogger.error(`[IA] Erro em funcoesSocket.message`, err?.message || err);
    }
  }

  /**
   * Notificar ACK de mensagem
   */
  async notifyMessageAck(response) {
    if (this.funcoesSocket && typeof this.funcoesSocket.ack === 'function') {
      this.funcoesSocket.ack(this.session, response);
    } else {
      customLogger.info(`⚠️ [${this.session}] funcoesSocket.ack não disponível`);
    }
    await this.webhooks?.wh_messages(this.session, response);
  }
}

module.exports = SocketWebhookManager;
