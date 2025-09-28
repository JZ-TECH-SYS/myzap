const Sessions = require("../../../controllers/SessionsController.js");
const get = require("async-get-file");
const path = require("path");
const fs = require("fs");
const util = require("util");
const urlExistsImport = require("url-exists");
const urlExists = util.promisify(urlExistsImport);
const engine = require("../../../engines/Venom.js");
const { Device } = require("../../../Models"); // ✅ ADICIONADO

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
      const sessionName = req.body.session;
      const sessionkey = req.headers['sessionkey']; // ✅ ADICIONADO

      // ✅ Verificar também no banco de dados (com sessionkey como WPPConnect)
      const deviceFromDB = await Device.findOne({ 
        where: { session: sessionName, sessionkey } 
      });

      // Usar helper padronizado para atualizar tentativas
      const helpSS = require('../../../controllers/helper/core/sessions.js');
      const updateSuccess = await helpSS.atualizarTentativasStartSeguro(sessionName, data);
      
      if (!updateSuccess) {
        console.log(`[WARNING] ${sessionName} - Falha ao atualizar tentativas`);
      }

      // ✅ Combinar dados da memória e banco
      if (data || deviceFromDB) {
        let status_permited = [
          "CONNECTED",
          "inChat",
          "isLogged",
          "isConnected",
          "connected"
        ];

        let responseData = {
          result: "success",
          session: sessionName,
        };

        // ✅ Priorizar status do banco se disponível
        const currentStatus = deviceFromDB?.status || data?.status;
        const isConnected = deviceFromDB?.connected || status_permited.includes(data?.status);

        if (isConnected && status_permited.includes(currentStatus)) {
          responseData.state = "CONNECTED";
          responseData.status = currentStatus;
        } else if (data?.state === "STARTING" || currentStatus === "INITIALIZING" || currentStatus === "connecting") {
          responseData.state = "STARTING";
          responseData.status = currentStatus || "INITIALIZING";
        } else if (data?.state === "QRCODE" || currentStatus === "qrcode") {
          responseData.state = "QRCODE";
          responseData.status = currentStatus || data?.status;
          responseData.qrcode = deviceFromDB?.qr_code || data?.qrCode;
          responseData.urlcode = data?.urlCode;
        } else {
          // ✅ CORRIGIDO - Não aguardar engine para não bloquear resposta
          engine.start(req, res, sessionName)
            .catch((error) => {
              console.error(`[VENOM ENGINE ERROR] ${sessionName}:`, error);
              Sessions.addInfoSession(sessionName, { 
                status: 'ENGINE_ERROR',
                state: 'DISCONNECTED',
                error: error.message 
              });
            });
            
          responseData.state = "STARTING";
          responseData.status = "INITIALIZING";
        }

        return res.status(200).json(responseData);
      } else {
        // ✅ CORRIGIDO - Não aguardar engine para não bloquear resposta
        engine.start(req, res, sessionName)
          .catch((error) => {
            console.error(`[VENOM ENGINE ERROR] ${sessionName}:`, error);
            Sessions.addInfoSession(sessionName, { 
              status: 'ENGINE_ERROR',
              state: 'DISCONNECTED',
              error: error.message 
            });
          });

        return res.status(200).json({
          result: "success",
          session: sessionName,
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

  // Funções adicionais para padronização com WPPConnect
  async sendMultipleFile64(req, res) {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        result: 400,
        status: "FAIL",
        message: "Array de arquivos base64 é obrigatório"
      });
    }

    try {
      const data = Sessions.getSession(req.body.session);
      const number = req.body.number + "@c.us";
      const responses = [];

      for (const fileInfo of files) {
        if (!fileInfo.data) continue;
        
        const filename = fileInfo.filename || 'file';
        const base64Data = fileInfo.data.replace(/^data:[^;]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const tempPath = `temp_${Date.now()}_${filename}`;
        
        fs.writeFileSync(tempPath, buffer);

        const response = await data.client.sendFile(
          number,
          tempPath,
          filename,
          fileInfo.caption || ""
        );
        
        fs.unlink(tempPath, () => null);
        
        responses.push({
          id: response.id,
          filename: filename,
          caption: fileInfo.caption || ""
        });
      }

      return res.status(200).json({
        result: 200,
        type: "files64",
        session: req.body.session,
        phone: number,
        files: responses
      });
    } catch (error) {
      return res.status(500).json({
        result: 500,
        status: "FAIL",
        message: error.message
      });
    }
  },

  async sendMultipleFiles(req, res) {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        result: 400,
        status: "FAIL",
        message: "Array de arquivos é obrigatório"
      });
    }

    try {
      const data = Sessions.getSession(req.body.session);
      const number = req.body.number + "@c.us";
      const responses = [];

      for (const fileInfo of files) {
        if (!fileInfo.path) continue;
        
        const isURL = await urlExists(fileInfo.path);
        const file = fileInfo.path.split(/[\/\\]/).pop();
        const localPath = isURL ? `files-received/${file}` : fileInfo.path;
        
        if (isURL) {
          await get(fileInfo.path, { directory: "files-received" });
        }

        const response = await data.client.sendFile(
          number,
          localPath,
          file,
          fileInfo.caption || ""
        );
        
        if (isURL) {
          fs.unlink(localPath, () => null);
        }
        
        responses.push({
          id: response.id,
          file: file,
          caption: fileInfo.caption || ""
        });
      }

      return res.status(200).json({
        result: 200,
        type: "files",
        session: req.body.session,
        phone: number,
        files: responses
      });
    } catch (error) {
      return res.status(500).json({
        result: 500,
        status: "FAIL",
        message: error.message
      });
    }
  },

  async sendListMessage(req, res) {
    // Lists não são mais suportados pelo WhatsApp
    return res.status(410).json({
      result: 410,
      status: "DEPRECATED",
      message: "sendListMessage foi descontinuado pelo WhatsApp"
    });
  },

  async sendOrderMessage(req, res) {
    const { productName, price, description } = req.body;
    
    if (!productName || !price) {
      return res.status(400).json({
        result: 400,
        status: "FAIL",
        message: "productName e price são obrigatórios"
      });
    }

    try {
      const data = Sessions.getSession(req.body.session);
      const number = req.body.number + "@c.us";
      
      // Formatando mensagem de pedido
      const orderText = `🛒 *PEDIDO*\n\n📦 Produto: ${productName}\n💰 Preço: ${price}\n${description ? `📄 Descrição: ${description}\n` : ''}\n---\nPedido gerado automaticamente`;
      
      const response = await data.client.sendText(number, orderText);
      
      return res.status(200).json({
        result: 200,
        type: "order",
        id: response.id,
        session: req.body.session,
        phone: number,
        product: productName,
        price: price,
        description: description || ""
      });
    } catch (error) {
      return res.status(500).json({
        result: 500,
        status: "FAIL",
        message: error.message
      });
    }
  },

  async sendPollMessage(req, res) {
    const { question, options } = req.body;
    
    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({
        result: 400,
        status: "FAIL",
        message: "Pergunta e pelo menos 2 opções são obrigatórias"
      });
    }

    try {
      const data = Sessions.getSession(req.body.session);
      const number = req.body.number + "@c.us";
      
      // Venom suporta polls nativamente
      const pollOptions = options.map(option => ({ name: option }));
      
      const response = await data.client.sendPollMessage(
        number,
        question,
        pollOptions
      );
      
      return res.status(200).json({
        result: 200,
        type: "poll",
        id: response.id,
        session: req.body.session,
        phone: number,
        question: question,
        options: options
      });
    } catch (error) {
      return res.status(500).json({
        result: 500,
        status: "FAIL",
        message: error.message
      });
    }
  },

  async downloadMediaByMessage(req, res) {
    const { messageId } = req.body;
    
    if (!messageId) {
      return res.status(400).json({
        result: 400,
        status: "FAIL",
        message: "messageId é obrigatório"
      });
    }

    try {
      const data = Sessions.getSession(req.body.session);
      
      const media = await data.client.downloadFileByMessage(messageId);
      
      return res.status(200).json({
        result: 200,
        type: "download",
        session: req.body.session,
        messageId: messageId,
        media: media
      });
    } catch (error) {
      return res.status(500).json({
        result: 500,
        status: "FAIL",
        message: error.message
      });
    }
  },

  async sendReactionToMessage(req, res) {
    const { messageId, emoji } = req.body;
    
    if (!messageId || !emoji) {
      return res.status(400).json({
        result: 400,
        status: "FAIL",
        message: "messageId e emoji são obrigatórios"
      });
    }

    try {
      const data = Sessions.getSession(req.body.session);
      
      const response = await data.client.sendReactionToMessage(messageId, emoji);
      
      return res.status(200).json({
        result: 200,
        type: "reaction",
        id: response.id,
        session: req.body.session,
        messageId: messageId,
        emoji: emoji
      });
    } catch (error) {
      return res.status(500).json({
        result: 500,
        status: "FAIL",
        message: error.message
      });
    }
  },

  // ✅ Função para verificar status da sessão (consistência com outros engines)
  async getSessionResponse(session, sessionkey = null) {
    try {
      // ✅ Primeiro verificar no banco de dados (com sessionkey como WPPConnect)
      const where = sessionkey ? { session, sessionkey } : { session };
      const deviceFromDB = await Device.findOne({ where });

      // ✅ Verificar na memória
      const sessionFromMemory = Sessions.getSession(session);

      // ✅ Priorizar dados do banco se existirem
      if (deviceFromDB) {
        return {
          session: session,
          state: deviceFromDB.state || (deviceFromDB.connected ? 'CONNECTED' : 'DISCONNECTED'),
          status: deviceFromDB.status || 'unknown',
          engine: 'venom',
          qrcode: deviceFromDB.qrCode || null,
          device: {
            wid: deviceFromDB.wid,
            phone: deviceFromDB.phone,
            platform: deviceFromDB.platform,
            battery: deviceFromDB.battery,
            pushname: deviceFromDB.pushname,
            wa_version: deviceFromDB.wa_version
          },
          source: 'database'
        };
      }

      // ✅ Fallback para dados da memória
      if (sessionFromMemory) {
        return {
          session: session,
          state: sessionFromMemory.status || 'UNKNOWN',
          status: sessionFromMemory.status || 'unknown',
          engine: 'venom',
          qrcode: sessionFromMemory.qrCode || null,
          device: sessionFromMemory.client ? 'connected' : 'disconnected',
          source: 'memory'
        };
      }

      // ✅ Nenhuma sessão encontrada
      return {
        session: session,
        state: 'NOT_FOUND',
        status: 'not_found',
        engine: 'venom',
        source: 'none'
      };

    } catch (error) {
      console.error(`[VENOM] Erro ao verificar status da sessão ${session}:`, error);
      return {
        session: session,
        state: 'ERROR',
        status: 'error',
        engine: 'venom',
        error: error.message,
        source: 'error'
      };
    }
  },
};
