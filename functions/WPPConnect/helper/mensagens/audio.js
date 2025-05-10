const Sessions = require('../../../../controllers/SessionsController');
const config = require('../../../../config');
const Cache = require('../../../../util/cache');
const logger = require('../../../../util/logger');

module.exports = {
  async sendAudio(req, res) {
    try {
      const { session, number, time_recording } = req.body;
      const path = req.body.path || req.files?.path;

      if (!path) {
        return res.status(400).send({
          status: 400,
          error: "Path não informado",
          message: "Informe o link do arquivo"
        });
      }

      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);

      await client.startRecording(phone, time_recording || config.time_typing);

      const isURL = Sessions.isURL(path);
      const base64 = isURL
        ? await Sessions.UrlToBase64(path)
        : await Sessions.fileToBase64(path, { createChat: true });

      const file = path.split(/[\/\\]/).pop();
      const ext = file.split('.').pop();

      if (['mp3', 'ogg', 'webm'].includes(ext)) {
        const response = await client.sendPttFromBase64(phone, base64);
        res.status(200).json({
          result: 200,
          type: 'ptt',
          session,
          file,
          data: response
        });
      } else {
        res.status(400).json({
          result: 400,
          status: "FAIL",
          log: "Envio de áudio permitido apenas com arquivos .mp3, .ogg ou .webm"
        });
      }
    } catch (error) {
      logger.error(`Error on sendAudio: ${error.message}`);
      res.status(500).json({ response: false, data: error.message });
    }
  },

  async sendVoiceBase64(req, res) {
    const { session, number, path, time_recording } = req.body;

    if (!path) {
      return res.status(400).send({
        status: 400,
        error: "Path não informado",
        message: "Informe o path em formato Base64"
      });
    }

    try {
      const device = await Sessions.getClient(session);
      const client = device.client;
      const phone = await Cache.get(number);

      await client.startRecording(phone, time_recording || config.time_typing);
      const response = await client.sendPttFromBase64(phone, path);

      res.status(200).json({
        result: 200,
        type: 'audio',
        messageId: response.id,
        session,
        data: response
      });
    } catch (error) {
      logger.error(`Error on sendVoiceBase64: ${error.message}`);
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
      logger.error(`Error on startRecording: ${error?.message}`);
      res.status(500).json({ response: false, data: error?.message });
    }
  },

  async stopRecording(req, res) {
    try {
      const { session, number, time } = req.body;
      const data = await Sessions.getClient(session);
      const phone = await Cache.get(number);
      const response = await data.client.stopRecoring(phone, time);
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on stopRecording: ${error?.message}`);
      res.status(500).json({ response: false, data: error?.message });
    }
  }
};
