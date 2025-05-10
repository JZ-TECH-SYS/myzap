const Sessions = require('../../../../controllers/SessionsController');
const config = require('../../../../config');
const Cache = require('../../../../util/cache');
const logger = require('../../../../util/logger');


module.exports = {
  async sendImage(req, res) {
    const { session, path, number, caption, isViewOnce } = req.body;

    if (!path) {
      return res.status(400).send({
        status: 400,
        error: "Path não informado",
        message: "Informe o link do arquivo, ele deve estar na internet"
      });
    }

    try {
      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);

      await Sessions.sleep(config.time_typing);

      const response = await client.sendImage(phone, path, 'imagem', caption, '', isViewOnce);

      res.status(200).json({
        result: 200,
        type: 'image',
        messageId: response?._serialized,
        session,
        data: response
      });
    } catch (error) {
      logger.error(`Error on sendImage: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async sendVideo(req, res) {
    const { session, path, number, caption } = req.body;

    if (!path) {
      return res.status(400).send({
        status: 400,
        error: "Path não informado",
        message: "Informe o link do arquivo"
      });
    }

    try {
      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);

      const isURL = Sessions.isURL(path);
      const name = path.split(/[\/\\]/).pop();
      const base64 = isURL
        ? await Sessions.UrlToBase64(path)
        : await Sessions.fileToBase64(path);

      const response = await client.sendFileFromBase64(phone, base64, name, caption);

      res.status(200).json({
        result: 200,
        type: 'video',
        session,
        file: name,
        data: response
      });
    } catch (error) {
      logger.error(`Error on sendVideo: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async sendFile(req, res) {
    const { session, path, number } = req.body;

    if (!path) {
      return res.status(400).send({
        status: 400,
        error: "Path não informado",
        message: "Informe o link do arquivo"
      });
    }

    try {
      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);

      const options = req.body.options || {
        createChat: true,
        filename: 'file'
      };

      const response = await client.sendFile(phone, path, options);

      res.status(200).json({
        result: 200,
        type: 'file',
        session,
        data: response
      });
    } catch (error) {
      logger.error(`Error on sendFile: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async sendFile64(req, res) {
    const { session, number, path, caption } = req.body;

    if (!path) {
      return res.status(400).send({
        status: 400,
        error: "Path em base64 não informado"
      });
    }

    try {
      const device = await Sessions.getClient(session);
      const phone = await Cache.get(number);

      const response = await device.client.sendFileFromBase64(phone, path, caption, caption);

      res.status(200).json({
        result: 200,
        type: 'file',
        session,
        data: response
      });
    } catch (error) {
      logger.error(`Error on sendFile64: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async sendMultipleFiles(req, res) {
    const { session, number, files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        status: 400,
        error: "Lista de arquivos (files[]) é obrigatória"
      });
    }

    try {
      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);

      const results = [];

      for (const file of files) {
        const { path, filename = 'file' } = file;
        if (!path) continue;

        const response = await client.sendFile(phone, path, {
          createChat: true,
          filename
        });

        results.push({
          path,
          filename,
          messageId: response?.id || null,
          success: !!response
        });

        await new Promise(r => setTimeout(r, 1000)); // opcional: delay
      }

      res.status(200).json({
        result: 200,
        session,
        number,
        total: results.length,
        files: results
      });
    } catch (error) {
      logger.error(`Error on sendMultipleFiles: ${error.message}`);
      res.status(500).json({ response: false, error: error.message });
    }
  },

  async sendSticker(req, res) {
    try {
      const { session, number } = req.body;
      const path = req.body.path || req.files?.path;

      if (!path) {
        return res.status(400).json({
          status: 400,
          error: "Path não informado",
          message: "Informe o link do arquivo",
        });
      }

      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);

      await Sessions.sleep(config.time_typing || 0);

      const isURL = Sessions.isURL(path);
      const name = path.split(/[\/\\]/).pop();
      const base64 = isURL
        ? await Sessions.UrlToBase64(path)
        : await Sessions.fileToBase64(path);

      const response = await client.page.evaluate(
        async ({ phone, base64 }) =>
          await WPP.chat.sendFileMessage(phone, base64, { type: 'sticker' }),
        { phone, base64 }
      );

      res.status(200).json({
        result: 200,
        type: 'sticker',
        messageId: response?.id,
        session,
        file: name,
        data: response,
      });

    } catch (error) {
      logger.error(`Error on sendSticker: ${error?.message}`);
      res.status(500).json({ response: false, data: error?.message });
    }
  }

};
