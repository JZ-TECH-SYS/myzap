const Sessions = require('../../../../controllers/SessionsController');
const config = require('../../../../config');
const Cache = require('../../../../util/cache');
const logger = require('../../../../util/logger');

module.exports = {
  async sendText(req, res) {
    const { session, number, text, time_typing, options } = req.body;
    try {
      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);

      let configMsg = {
        createChat: true,
        delay: time_typing || 0,
        ...options
      };

      const response = await client.sendText(phone, text, configMsg);

      res.status(200).json({
        result: 200,
        data: response
      });
    } catch (error) {
      logger.error(`Error on sendText: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async reply(req, res) {
    const { session, number, messageid, text } = req.body;
    if (!text || !messageid) {
      return res.status(400).json({ status: 400, error: "Texto e ID da mensagem são obrigatórios" });
    }

    try {
      const device = await Sessions.getClient(session);
      const phone = await Cache.get(number);
      await Sessions.sleep(config.time_typing);

      const response = await device.client.reply(phone, text, messageid);

      res.status(200).json({
        result: 200,
        type: 'text',
        session,
        messageId: response?.id,
        data: response
      });
    } catch (error) {
      logger.error(`Error on reply: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async forwardMessages(req, res) {
    const { session, number, messageid, options } = req.body;
    if (!messageid) {
      return res.status(400).json({ status: 400, error: "MessageID não foi informado" });
    }

    try {
      const device = await Sessions.getClient(session);
      const phone = await Cache.get(number);
      await Sessions.sleep(config.time_typing);

      const response = await device.client.forwardMessage(phone, messageid, options || {});

      res.status(200).json({
        result: 200,
        type: 'forward',
        session,
        data: response
      });
    } catch (error) {
      logger.error(`Error on forwardMessages: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async editMessage(req, res) {
    const { session, messageid, newText } = req.body;
    try {
      const device = await Sessions.getClient(session);
      const response = await device.client.editMessage(messageid, newText);

      res.status(200).json({
        result: 200,
        data: response
      });
    } catch (error) {
      logger.error(`Error on editMessage: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  }
};
