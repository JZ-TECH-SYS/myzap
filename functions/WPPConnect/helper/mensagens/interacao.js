const Sessions = require('../../../../controllers/SessionsController');
const Cache = require('../../../../util/cache');
const logger = require('../../../../util/logger');

module.exports = {
  async startTyping(req, res) {
    try {
      const { session, number, time } = req.body;
      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);

      const response = await data.client.startTyping(phone, time);
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on startTyping: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async stopTyping(req, res) {
    try {
      const { session, number } = req.body;
      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);

      const response = await data.client.stopTyping(phone);
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on stopTyping: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async startRecording(req, res) {
    try {
      const { session, number, time } = req.body;
      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);

      const response = await data.client.startRecording(phone, time);
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on startRecording: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async stopRecording(req, res) {
    try {
      const { session, number } = req.body;
      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);

      const response = await data.client.stopRecoring(phone);
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on stopRecording: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async sendReactionToMessage(req, res) {
    try {
      const { session, messageId, emoji } = req.body;

      if (!messageId || !emoji) {
        return res.status(400).json({
          status: 400,
          error: "MessageId e emoji são obrigatórios"
        });
      }

      const data = await Sessions.getClient(session);

      const response = await data.client.page.evaluate(
        async ({ messageId, emoji }) =>
          await WPP.chat.sendReactionToMessage(messageId, emoji),
        { messageId, emoji }
      );

      res.status(200).json({
        result: 'success',
        message: 'Reaction submitted successfully',
        data: response
      });
    } catch (error) {
      logger.error(`Error on sendReactionToMessage: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },
  async createNewsletter(req, res) {
    try {
      const { session, name, options } = req.body;
      const data = await Sessions.getClient(session);
      const response = await data.client.createNewsletter(name, options);
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on createNewsletter: ${error?.message}`);
      res.status(500).json({ response: false, data: error?.message });
    }
  },

  async editMessage(req, res) {
    try {
      const { session, messageid, newText } = req.body;
      const data = await Sessions.getClient(session);
      const response = await data.client.editMessage(messageid, newText);
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on editMessage: ${error?.message}`);
      res.status(500).json({ response: false, data: error?.message });
    }
  },

  async sendListMessage(req, res) {
    try {
      const { session, number, description = '', sections, buttonText = 'SELECIONE UMA OPÇÃO' } = req.body;
      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);
      const response = await client.sendListMessage(phone, { buttonText, description, sections });
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on sendListMessage: ${error?.message}`);
      res.status(500).json({ response: false, data: error?.message });
    }
  },

  async sendOrderMessage(req, res) {
    try {
      const { session, number, items, options = {} } = req.body;
      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);
      const response = await client.sendOrderMessage(phone, items, options);
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on sendOrderMessage: ${error?.message}`);
      res.status(500).json({ response: false, data: error?.message });
    }
  },

  async sendPollMessage(req, res) {
    try {
      const { number, name, choices, options, selectableCount, session } = req.body;
      const data = await Sessions.getClient(session);
      const client = data.client;
      const phone = await Cache.get(number);
      const response = await client.sendPollMessage(phone, name, choices, options, {
        selectableCount: selectableCount || 1,
      });
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on sendPollMessage: ${error?.message}`);
      res.status(500).json({ response: false, data: error?.message });
    }
  },

  async getPlatformFromMessage(req, res) {
    try {
      const { messageId, session } = req.body;
      const device = await Sessions.getClient(session);
      const client = device.client;
  
      const response = await client.getPlatformFromMessage(messageId);
  
      res.status(200).json({
        status: 'success',
        data: response
      });
    } catch (error) {
      logger.error(`Error on getPlatformFromMessage: ${error?.message}`);
      return res.status(500).json({ response: false, data: error?.message });
    }
  }
  
};
