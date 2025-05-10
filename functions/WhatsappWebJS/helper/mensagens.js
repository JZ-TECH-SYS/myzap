const Sessions = require("../../../controllers/SessionsController");
const get = require("async-get-file");
const fs = require("fs");
const whatsappweb = require("whatsapp-web.js");
const util = require("util");
const urlExistsImport = require("url-exists");
const engine = require("../../../engines/WhatsappWebJS");

const urlExists = util.promisify(urlExistsImport);
const { MessageMedia, Location } = whatsappweb;

function buildNumber(req) {
  return req.body.isGroup
    ? req.body.number + "@g.us"
    : req.body.number + "@c.us";
}

module.exports = {
  async sendText(req, res) {
    const data = Sessions.getSession(req.body.session);
    const number = buildNumber(req);
    const text = req.body.text;

    if (!text) {
      return res
        .status(400)
        .json({ status: 400, error: "Text não foi informado" });
    }

    try {
      const response = await data.client.sendMessage(number, text);
      return res.status(200).json({
        result: 200,
        type: "text",
        id: response.id._serialized,
        phone: response.to,
        content: response.body,
      });
    } catch (error) {
      return res.status(500).json({ status: "FAIL", error });
    }
  },

  async addStatusText(req, res) {
    const data = Sessions.getSession(req.body.session);
    await data.client.sendMessage("status@broadcast", req.body.text);
    return res.status(200).json({ result: "success" });
  },

  async sendImage(req, res) {
    return sendMedia(req, res, "image");
  },

  async sendVideo(req, res) {
    return sendMedia(req, res, "video");
  },

  async sendSticker(req, res) {
    return sendMedia(req, res, "sticker");
  },

  async sendFile(req, res) {
    return sendMedia(req, res, "file");
  },

  async sendAudio(req, res) {
    return sendMedia(req, res, "audio");
  },

  async sendLocation(req, res) {
    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";
    const { lat, log, title, description } = req.body;

    if (!lat || !log || !title || !description) {
      return res
        .status(400)
        .json({ status: 400, error: "Dados de localização incompletos" });
    }

    try {
      const loc = new Location(lat, log, `${title}\n${description}`);
      const response = await data.client.sendMessage(number, loc);
      return res.status(200).json({
        result: 200,
        type: "locate",
        id: response.id._serialized,
        session: req.body.session,
        phone: response.id.remote._serialized,
        mimetype: response.type,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async sendContact(req, res) {
    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";

    if (!req.body.contact || !req.body.name) {
      return res
        .status(400)
        .json({ status: 400, error: "Dados do contato incompletos" });
    }

    try {
      const response = await data.client.sendMessage(
        number,
        req.body.contact + "@c.us",
        { parseVCards: true }
      );
      return res.status(200).json({
        result: 200,
        type: "contact",
        messageId: response.id,
        session: req.body.session,
        phone: response.to.user,
        content: response.content,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async sendLink(req, res) {
    const data = Sessions.getSession(req.body.session);
    const number = buildNumber(req);

    if (!req.body.url) {
      return res
        .status(400)
        .json({ status: 400, error: "URL não foi informada" });
    }

    try {
      const response = await data.client.sendMessage(
        number,
        req.body.url,
        req.body.text,
        { linkPreview: true }
      );
      return res.status(200).json({
        result: 200,
        type: "link",
        messageId: response.id,
        session: req.body.session,
        phone: response.to.user,
        content: response.content,
      });
    } catch (error) {
      return res.status(400).json({ result: 400, status: "FAIL", log: error });
    }
  },

  async sendMedia(req, res, type) {
    const data = Sessions.getSession(req.body.session);
    const number = req.body.number + "@c.us";
    const filePath = req.body.path;
    const isURL = await urlExists(filePath);
    const name = filePath?.split(/[\/]/).pop();
    const dir = "files-received/";
    const fullPath = isURL ? dir + name : filePath;

    if (!filePath) {
      return res.status(400).send({ status: 400, error: "Path não informado" });
    }

    try {
      if (isURL) await get(filePath, { directory: dir });

      const media = MessageMedia.fromFilePath(fullPath);
      const sendOptions =
        type === "sticker"
          ? { sendMediaAsSticker: true }
          : type === "audio"
          ? { sendAudioAsVoice: true }
          : { caption: req.body.caption || "" };
      const response = await data.client.sendMessage(
        number,
        media,
        sendOptions
      );

      if (isURL) fs.unlinkSync(fullPath);

      return res.status(200).json({
        result: 200,
        type,
        id: response.id._serialized,
        session: req.body.session,
        phone: response.id.remote._serialized,
        file: filePath,
        content: response.body,
        mimetype: response.type,
      });
    } catch (error) {
      return res.status(500).json({ status: "error", message: error });
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
  },
};
