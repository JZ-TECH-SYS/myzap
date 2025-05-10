const Sessions = require('../../../../controllers/SessionsController');
const config = require('../../../../config');
const Cache = require('../../../../util/cache');
const logger = require('../../../../util/logger');


module.exports = {
  async sendLocation(req, res) {
    const { session, number, lat, log, title, description, buttons } = req.body;

    if (!lat || !log || !title || !description) {
      return res.status(400).json({
        status: 400,
        error: "Campos obrigatórios: lat, log, title, description"
      });
    }

    try {
      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);

      await Sessions.sleep(config.time_typing);
      const response = await data.client.page.evaluate(
        async ({ phone, lat, log, title, description, buttons }) =>
          await WPP.chat.sendLocationMessage(phone, {
            lat,
            lng: log,
            name: title,
            address: `${title}\n${description}`,
            buttons,
          }),
        { phone, lat, log, title, description, buttons }
      );

      res.status(200).json({
        result: 200,
        type: 'locate',
        messageId: response.id,
        session,
        data: response
      });
    } catch (error) {
      logger.error(`Error on sendLocation: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async sendContact(req, res) {
    const { session, number, contact, name } = req.body;

    if (!contact || !name) {
      return res.status(400).json({
        status: 400,
        error: "Campos obrigatórios: contact e name"
      });
    }

    try {
      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);

      const response = await data.client.sendContactVcard(phone, `${contact}@c.us`, name);

      res.status(200).json({
        result: 200,
        type: 'contact',
        messageId: response.id,
        session,
        data: response
      });
    } catch (error) {
      logger.error(`Error on sendContact: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  }
};
