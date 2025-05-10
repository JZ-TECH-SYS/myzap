const Sessions = require('../../../../controllers/SessionsController');
const Cache = require('../../../../util/cache');
const logger = require('../../../../util/logger');

module.exports = {
  async sendFile(req, res) {
    try {
      const { session, path, number } = req.body;
      if (!path) {
        return res.status(400).json({ status: 400, error: "Path não informado" });
      }

      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);

      const options = req.body.options || { createChat: true, filename: "file" };
      const response = await client.sendFile(phone, path, options);

      res.status(200).json({ result: 200, type: 'file', session, data: response });

    } catch (error) {
      logger.error(`Error on sendFile: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async sendMultipleFiles(req, res) {
    try {
      const { session, number, files } = req.body;
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ status: 400, error: "Lista de arquivos é obrigatória" });
      }

      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);

      const results = [];
      for (const file of files) {
        const { path, filename = 'file' } = file;
        if (!path) continue;

        const response = await client.sendFile(phone, path, { createChat: true, filename });
        results.push({ path, filename, messageId: response?.id, success: !!response });
        await new Promise(r => setTimeout(r, 1000));
      }

      res.status(200).json({ result: 200, session, number, total: results.length, files: results });

    } catch (error) {
      logger.error(`Error on sendMultipleFiles: ${error.message}`);
      res.status(500).json({ response: false, error: error.message });
    }
  },

  async sendFileLocal(req, res) {
    try {
      const { session, number, caption } = req.body;
      if (!req.files?.file) {
        return res.status(400).json({ status: 400, error: "Arquivo não enviado" });
      }

      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);
      const file = req.files.file;

      const base64 = `data:${file.mimetype};base64,${Buffer.from(file.data).toString('base64')}`;
      const response = await data.client.sendFileFromBase64(phone, base64, file.name, caption);

      res.status(200).json({ result: 200, type: 'file', session, file: file.name, data: response });

    } catch (error) {
      logger.error(`Error on sendFileLocal: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async sendFile64(req, res) {
    try {
      const { session, number, path, caption } = req.body;
      if (!path) {
        return res.status(400).json({ status: 400, error: "Base64 não informado" });
      }

      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);
      const response = await data.client.sendFileFromBase64(phone, path, caption, caption);

      res.status(200).json({ result: 200, type: 'file', session, data: response });

    } catch (error) {
      logger.error(`Error on sendFile64: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async sendMultipleFile64(req, res) {
    try {
      const { session, number, files } = req.body;
      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ status: 400, error: "Arquivos Base64 são obrigatórios" });
      }

      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);
      const results = [];

      for (const file of files) {
        const { base64, filename = 'arquivo', caption = '' } = file;
        if (!base64) continue;

        const response = await client.sendFileFromBase64(phone, base64, filename, caption);
        results.push({ filename, caption, success: !!response, messageId: response?.id });
        await new Promise(r => setTimeout(r, 1000));
      }

      res.status(200).json({ result: 200, session, number, total: results.length, files: results });

    } catch (error) {
      logger.error(`Error on sendMultipleFile64: ${error.message}`);
      res.status(500).json({ response: false, error: error.message });
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
        data: message,
      });
  
    } catch (error) {
      logger.error(`Error on downloadMediaByMessage: ${error?.message}`);
      return res.status(500).json({ response: false, data: error?.message });
    }
  }
  
};
