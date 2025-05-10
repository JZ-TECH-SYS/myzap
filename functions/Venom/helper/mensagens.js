const Sessions = require("../../../controllers/SessionsController.js");
const get = require("async-get-file");
const path = require("path");
const fs = require("fs");
const util = require("util");
const urlExistsImport = require("url-exists");
const urlExists = util.promisify(urlExistsImport);
const engine = require("../../../engines/Venom.js");

module.exports = {
  async sendAudio(req, res) {
    const { path: audioPath } = req.body;
    if (!audioPath) {
      return res.status(400).json({ status: 400, error: "Path não informado" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";
    const isURL = await urlExists(audioPath);
    const file = audioPath.split(/[\/\\]/).pop();
    const name = file.split(".")[0];
    const ext = file.split(".").pop();

    if (!["mp3", "ogg", "webm"].includes(ext)) {
      return res
        .status(400)
        .json({
          result: 400,
          status: "FAIL",
          log: "Apenas .mp3, .ogg ou .webm são aceitos",
        });
    }

    try {
      const localPath = isURL ? `files-received/${file}` : audioPath;
      if (isURL) await get(audioPath, { directory: "files-received" });

      const response = await data.client.sendPtt(number, localPath);
      if (isURL) fs.unlink(localPath, () => null);

      return res.status(200).json({
        result: 200,
        type: "ptt",
        messageId: response.id,
        session: req.body.session,
        file: name,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async sendVoiceBase64(req, res) {
    const { path: base64, number } = req.body;
    if (!base64) {
      return res
        .status(400)
        .json({ status: 400, error: "Base64 não informado" });
    }

    const data = Sessions.getSession(req.body.session);

    try {
      const response = await data.client.sendPttFromBase64(number, base64);
      return res.status(200).json({
        result: 200,
        type: "audio",
        messageId: response.id,
        session: req.body.session,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async sendLink(req, res) {
    const { url, text } = req.body;
    if (!url) {
      return res.status(400).json({ status: 400, error: "URL obrigatória" });
    }

    const isValid = await urlExists(url);
    if (!isValid) {
      return res.status(400).json({ status: 400, error: "URL inválida" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.isGroup
      ? req.body.number + "@g.us"
      : req.body.number + "@c.us";

    try {
      const response = await data.client.sendLinkPreview(number, url, text);
      return res.status(200).json({
        result: 200,
        type: "link",
        messageId: response.id,
        session: req.body.session,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async sendContact(req, res) {
    const { contact, name } = req.body;
    if (!contact || !name) {
      return res
        .status(400)
        .json({ status: 400, error: "Contact e nome obrigatórios" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";

    try {
      const response = await data.client.sendContactVcard(
        number,
        contact + "@c.us",
        name
      );
      return res.status(200).json({
        result: 200,
        type: "contact",
        messageId: response.id,
        session: req.body.session,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async sendLocation(req, res) {
    const { lat, log, title, description } = req.body;
    if (!lat || !log || !title || !description) {
      return res
        .status(400)
        .json({ status: 400, error: "Dados incompletos da localização" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";

    try {
      const response = await data.client.sendLocation(
        number,
        lat,
        log,
        `${title}\n${description}`
      );
      return res.status(200).json({
        result: 200,
        type: "locate",
        messageId: response.id,
        session: req.body.session,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async reply(req, res) {
    const { text, messageid } = req.body;
    if (!text || !messageid) {
      return res
        .status(400)
        .json({ status: 400, error: "Texto e MessageID obrigatórios" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";

    try {
      const response = await data.client.reply(number, text, messageid);
      return res.status(200).json({
        result: 200,
        type: "text",
        messageId: response.id,
        session: req.body.session,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async forwardMessages(req, res) {
    const { messageid } = req.body;
    if (!messageid) {
      return res
        .status(400)
        .json({ status: 400, error: "MessageID obrigatório" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";

    try {
      const response = await data.client.forwardMessages(number, [messageid]);
      return res.status(200).json({
        result: 200,
        type: "forward",
        messageId: response.id,
        session: req.body.session,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", error });
    }
  },

  async getOrderbyMsg(req, res) {
    const { messageid } = req.body;
    if (!messageid) {
      return res
        .status(400)
        .json({ status: 400, error: "MessageID obrigatório" });
    }

    const data = Sessions.getSession(req.body.session);

    try {
      const response = await data.client.getOrderbyMsg(messageid);
      return res.status(200).json({
        result: 200,
        type: "order",
        session: req.body.session,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", error });
    }
  },

  async sendText(req, res) {
    const data = Sessions.getSession(req.body.session);
    const number = req.body.isGroup
      ? req.body.number + "@g.us"
      : req.body.number + "@c.us";

    if (!req.body.text) {
      return res
        .status(400)
        .json({ status: 400, error: "Texto não foi informado" });
    }

    try {
      const response = await data.client.sendText(number, req.body.text);
      return res.status(200).json({
        result: 200,
        type: "text",
        messageId: response.to._serialized,
        session: req.body.session,
        data: response,
      });
    } catch (error) {
      return res.status(500).json({ result: 500, error });
    }
  },

  async sendImage(req, res) {
    const { caption, path: imagePath } = req.body;
    if (!imagePath) {
      return res.status(400).json({ status: 400, error: "Path não informado" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";

    try {
      const response = await data.client.sendImage(
        number,
        imagePath,
        "imagem",
        caption
      );
      return res.status(200).json({
        result: 200,
        type: "image",
        messageId: response.id,
        session: req.body.session,
        file: req.body.url,
        data: response,
      });
    } catch (error) {
      return res.status(500).json({ result: 500, error });
    }
  },

  async sendVideo(req, res) {
    const { path: videoPath } = req.body;
    if (!videoPath) {
      return res
        .status(400)
        .json({ status: 400, error: "Path do vídeo não informado" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";
    const isURL = await urlExists(videoPath);
    const name = videoPath.split(/[\/\\]/).pop();

    try {
      const localPath = isURL ? `files-received/${name}` : videoPath;
      if (isURL) await get(videoPath, { directory: "files-received" });

      const response = await data.client.sendFile(
        number,
        localPath,
        "Video",
        req.body.caption
      );
      if (isURL) fs.unlink(localPath, () => null);

      return res.status(200).json({
        result: 200,
        type: "video",
        session: req.body.session,
        messageId: response.id,
        file: name,
        data: response,
      });
    } catch (error) {
      return res.status(500).json({ result: 500, error });
    }
  },

  async sendSticker(req, res) {
    const { path: stickerPath } = req.body;
    if (!stickerPath) {
      return res.status(400).json({ status: 400, error: "Path não informado" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";
    const isURL = await urlExists(stickerPath);
    const name = stickerPath.split(/[\/\\]/).pop();
    const localPath = isURL ? `files-received/${name}` : stickerPath;

    try {
      if (isURL) await get(stickerPath, { directory: "files-received" });

      const response = await data.client.sendImageAsSticker(number, localPath);
      if (isURL) fs.unlink(localPath, () => null);

      return res.status(200).json({
        result: 200,
        type: "sticker",
        messageId: response.id,
        session: req.body.session,
        file: name,
        data: response,
      });
    } catch (error) {
      return res.status(500).json({ result: 500, error });
    }
  },

  async sendFile(req, res) {
    const { path: filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ status: 400, error: "Path não informado" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";
    const isURL = await urlExists(filePath);
    const name = filePath.split(/[\/\\]/).pop();
    const localPath = isURL ? `files-received/${name}` : filePath;

    try {
      if (isURL) await get(filePath, { directory: "files-received" });

      const response = await data.client.sendFile(
        number,
        localPath,
        "File",
        req.body.caption
      );
      if (isURL) fs.unlink(localPath, () => null);

      return res.status(200).json({
        result: 200,
        type: "file",
        messageId: response.id,
        session: req.body.session,
        file: name,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async sendFile64(req, res) {
    const { path: base64 } = req.body;
    if (!base64) {
      return res
        .status(400)
        .json({ status: 400, error: "Base64 não informado" });
    }

    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";
    const name = base64.split(/[\/\\]/).pop();

    try {
      const response = await data.client.sendFileFromBase64(
        number,
        base64,
        "File",
        req.body.caption
      );
      return res.status(200).json({
        result: 200,
        type: "file",
        messageId: response.id,
        session: req.body.session,
        file: name,
        data: response,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async startSession(req, res) {
    let session = req.body.session;
    let data = await Sessions.getClient(session);

    try {
      // Exemplo de como acessar o número de solicitações de um usuário específico
      const session = req.body.session;

      let last_start = new Date(data.last_start);

      await Device.update(
        {
          last_start: last_start,
          attempts_start: data.attempts_start + 1,
        },
        { where: { session: session } }
      );

      if (data) {
        let status_permited = [
          "CONNECTED",
          "inChat",
          "isLogged",
          "isConnected",
        ];

        if (status_permited.includes(data?.status)) {
          return res.status(200).json({
            result: "success",
            session: session,
            state: "CONNECTED",
            status: data?.status,
          });
        } else if (data?.state === "STARTING") {
          return res.status(200).json({
            result: "success",
            session: session,
            state: "STARTING",
            status: data?.status,
          });
        } else if (data.state === "QRCODE") {
          return res.status(200).json({
            result: "success",
            session: session,
            state: data?.state,
            status: data?.status,
            qrcode: data?.qrCode,
            urlcode: data?.urlCode,
          });
        } else if (data.status === "INITIALIZING") {
          return res.status(200).json({
            result: "success",
            session: session,
            state: "STARTING",
            status: data?.status,
          });
        } else {
          engine.start(req, res);

          return res.status(200).json({
            result: "success",
            session: session,
            state: "STARTING",
            status: "INITIALIZING",
          });
        }
      } else {
        engine.start(req, res);

        return res.status(200).json({
          result: "success",
          session: session,
          state: "STARTING",
          status: "INITIALIZING",
        });
      }
    } catch (error) {
      console.log("error", error);

      res.status(500).json({
        result: 500,
        status: "FAIL",
        response: false,
        data: error,
      });
    }
  }
};
