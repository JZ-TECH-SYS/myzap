const Sessions = require('../../../../controllers/SessionsController');
const logger = require('../../../../util/logger');
const engine = require('../../../../engines/WppConnect');
const helpSS = require('../../../../controllers/helper/sessions');
const http = require('../../../../controllers/helper/http');

module.exports = {
  async getPlatformFromMessage(req, res) {
    try {
      const { messageId, session } = req.body;
      const device = await Sessions.getClient(session);
      const response = await device.client.getPlatformFromMessage(messageId);

      res.status(200).json({ status: 'success', data: response });

    } catch (error) {
      logger.error(`Error on getPlatformFromMessage: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async downloadMediaByMessage(req, res) {
    try {
      const { session, messageId } = req.body;
      const device = await Sessions.getClient(session);
      const message = await device.client.getMessageById(messageId);

      if (!message) return res.status(400).json({ status: 'error', message: 'Message not found' });
      if (!(message.mimetype || message.isMedia || message.isMMS)) {
        return res.status(400).json({ status: 'error', message: 'Message does not contain media' });
      }

      const buffer = await device.client.decryptFile(message);

      res.status(200).json({
        result: 200,
        base64: buffer.toString('base64'),
        mimetype: message.mimetype,
        session,
        file: message.filename,
        data: message,
      });

    } catch (error) {
      logger.error(`Error on downloadMediaByMessage: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async editMessage(req, res) {
    try {
      const { session, messageid, newText } = req.body;
      const device = await Sessions.getClient(session);
      const response = await device.client.editMessage(messageid, newText);

      res.status(200).json({ result: 200, data: response });

    } catch (error) {
      logger.error(`Error on editMessage: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },
  async sendLink(req, res) {
    const { session, number, url, text } = req.body;

    if (!url || !Sessions.isURL(url)) {
      return res.status(400).json({
        status: 400,
        error: "URL inválida ou não informada"
      });
    }

    try {
      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);
      await Sessions.sleep(config.time_typing);
      const response = await data.client.sendLinkPreview(phone, url, text);

      return res.status(200).json({
        result: 200,
        type: 'link',
        messageId: response?.id,
        session,
        data: response
      });

    } catch (error) {
      logger.error(`Error on sendLink: ${error?.message}`);
      return res.status(500).json({ response: false, data: error?.message });
    }
  },

  async sendContact(req, res) {
    const { session, number, contact, name } = req.body;

    if (!contact || !name) {
      return res.status(400).json({
        status: 400,
        error: "Contact e Nome são obrigatórios"
      });
    }

    try {
      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);
      const response = await data.client.sendContactVcard(phone, `${contact}@c.us`, name);

      return res.status(200).json({
        result: 200,
        type: 'contact',
        messageId: response?.id,
        session,
        data: response
      });

    } catch (error) {
      logger.error(`Error on sendContact: ${error?.message}`);
      return res.status(500).json({ response: false, data: error?.message });
    }
  },

  async downloadMediaByMessage(req, res) {
    const { session, messageId } = req.body;

    try {
      const device = await Sessions.getClient(session);
      const client = device.client;
      const message = await client.getMessageById(messageId);

      if (!message) {
        return res.status(400).json({ status: 'error', message: 'Message not found' });
      }

      if (!(message.mimetype || message.isMedia || message.isMMS)) {
        return res.status(400).json({ status: 'error', message: 'Message does not contain media' });
      }

      const buffer = await client.decryptFile(message);

      res.status(200).json({
        result: 200,
        base64: buffer.toString('base64'),
        mimetype: message.mimetype,
        session,
        file: message.filename,
        data: message
      });

    } catch (error) {
      logger.error(`Error on downloadMediaByMessage: ${error?.message}`);
      return res.status(500).json({ response: false, data: error?.message });
    }
  },
  async startSession(req, res) {
    const session = req.body.session;
    const data = await Sessions.getClient(session);

    console.log('[DEBUG] startSession', session);
    try {
      if (data) {
        await helpSS.atualizarTentativasStart(session, data.attempts_start, new Date(data.last_start));
        const status = data.status;
        const state = data.state;

        const resposta = {
          result: 'success',
          session,
          state: state || 'STARTING',
          status: status || 'INITIALIZING'
        };

        if (['CONNECTED', 'inChat', 'isLogged', 'isConnected'].includes(status)) {
          resposta.state = 'CONNECTED';
        } else if (state === 'QRCODE') {
          resposta.qrcode = data.qrCode;
          resposta.urlcode = data.urlCode;
        } else if (status === 'INITIALIZING') {
          resposta.state = 'STARTING';
        } else {
          engine.start(req, res);
        }

        return http.json(res, 200, resposta);
      }

      engine.start(req, res);
      return http.json(res, 200, {
        result: 'success',
        session,
        state: 'STARTING',
        status: 'INITIALIZING'
      });

    } catch (err) {
      console.log('error', err);
      return http.fail(res, err, 500, 'Erro ao iniciar sessão');
    }
  }
};
