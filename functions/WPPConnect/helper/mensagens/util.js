const Sessions = require('../../../../controllers/SessionsController');
const customLogger = require('../../../../util/customLogger.js'); // ✅ Logger padronizado
const engine = require('../../../../engines/WppConnect');
const helpSS = require('../../../../controllers/helper/sessions');
const http = require('../../../../controllers/helper/http');
const config = require('../../../../config.js');
const Device = require('../../../../Models/device.js')(config.sequelize);
const wppHelper = require('../../../../engines/helper/wpp'); // 🆕 Para cleanBrowserCache

module.exports = {
  async getPlatformFromMessage(req, res) {
    try {
      const { messageId, session } = req.body;
      const device = await Sessions.getClient(session);
      const response = await device.client.getPlatformFromMessage(messageId);

      res.status(200).json({ status: 'success', data: response });

    } catch (error) {
      customLogger.error(`Error on getPlatformFromMessage: ${error.message}`);
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
      customLogger.error(`Error on downloadMediaByMessage: ${error.message}`);
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
      customLogger.error(`Error on editMessage: ${error.message}`);
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
      customLogger.error(`Error on sendLink: ${error?.message}`);
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
      customLogger.error(`Error on sendContact: ${error?.message}`);
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
      customLogger.error(`Error on downloadMediaByMessage: ${error?.message}`);
      return res.status(500).json({ response: false, data: error?.message });
    }
  },
  async startSession(req, res) {
    const session = req.body.session;
    customLogger.debug('[DEBUG] startSession', session);

    const data = await Sessions.getClient(session);

    try {
      // Verifica se existe uma pasta de sessão em ./instances/<session>
      const fs = require('fs');
      const path = require('path');
      const sessionPath = path.join('./instances', session);
      const sessionExists = fs.existsSync(sessionPath);

      if (data) {
        // Atualiza tentativas de start no banco, mantendo compatibilidade com a lógica existente
        await helpSS.atualizarTentativasStart(session, data.attempts_start, new Date(data.last_start));

        const status = data.status;
        const state = data.state;

        // 🚨 CONTROLE DE CONCORRÊNCIA VIA BANCO 🚨
        // Se já está inicializando, NÃO deixa entrar (evita sobrescrever)
        if (status === 'INITIALIZING' || state === 'STARTING') {
          customLogger.info(`[IDEMPOTENT] ${session} - Já inicializando no banco, retornando estado atual`);
          return http.json(res, 200, {
            result: 'success',
            session,
            state: state || 'STARTING',
            status: status || 'INITIALIZING',
            message: 'Já inicializando. Aguarde...'
          });
        }

        // Monta objeto de resposta padrão
        const resposta = {
          result: 'success',
          session,
          state: state || 'STARTING',
          status: status || 'INITIALIZING'
        };

        // Verifica se há um client injetado na memória
        const injectedClient = helpSS.getInjectedClient(session);
        let clientActive = false;
        if (injectedClient) {
          try {
            // Algumas versões do WPPConnect possuem o método getConnectionState para checar o estado atual
            if (typeof injectedClient.getConnectionState === 'function') {
              const currentState = await injectedClient.getConnectionState();
              // Considera conectado se o estado estiver entre os estados conhecidos de conexão
              clientActive = ['inChat', 'isLogged', 'CONNECTED', 'isConnected'].includes(currentState);
            } else {
              // Se não houver método para checar estado, considera que está ativo
              clientActive = true;
            }
          } catch (_err) {
            // Qualquer erro ao checar o estado indica que o client não está ativo
            clientActive = false;
          }
        }

        // Caso exista pasta de sessão e status indique conexão, decide se mantém conectado ou se reconecta
        if (sessionExists && ['CONNECTED', 'inChat', 'isLogged', 'isConnected'].includes(status)) {
          if (clientActive) {
            // Sessão está conectada e client ativo: apenas retornar conectado
            resposta.state = 'CONNECTED';
            resposta.status = status;
            return http.json(res, 200, resposta);
          } else {
            // Sessão deveria estar conectada mas client não está em memória: tentar reconexão automática
            customLogger.info(`[RECONNECT] ${session} - Sessão existe mas client inativo, iniciando reconexão...`);
            
            // 🧹 LIMPEZA AUTOMÁTICA DO CACHE antes da reconexão
            await wppHelper.cleanBrowserCache(session);
            
            // 🛡️ Marca como inicializando no banco ANTES de chamar engine
            await Device.update({
              state: 'STARTING',
              status: 'INITIALIZING',
              updated_at: new Date()
            }, { where: { session } });
            
            engine.start(req, res);
            resposta.state = 'STARTING';
            resposta.status = 'RECONNECTING';
            return http.json(res, 200, resposta);
          }
        }

        // ⚡ NOVA LÓGICA: /start só força QR novo se NÃO estiver inicializando
        // Para qualquer outro estado (incluindo QR expirado), força nova inicialização
        customLogger.info(`[FORCE NEW QR] ${session} - Status: ${status}, forçando nova inicialização`);
        
        // 🛡️ Marca como inicializando no banco ANTES de chamar engine
        await Device.update({
          state: 'STARTING',
          status: 'INITIALIZING', 
          qrCode: '',
          urlCode: '',
          attempts: 0,
          updated_at: new Date()
        }, { where: { session } });
        
        engine.start(req, res);
        return http.json(res, 200, {
          result: 'success',
          session,
          state: 'STARTING',
          status: 'INITIALIZING',
          message: 'Gerando novo QR code...'
        });
      }

      // Não há dados no banco: iniciar nova sessão
      customLogger.info(`[START FRESH] ${session} - Nenhum dado encontrado, iniciando engine…`);
      
      // 🛡️ Marca como inicializando no banco ANTES de chamar engine
      await Device.update({
        state: 'STARTING',
        status: 'INITIALIZING',
        qrCode: '',
        urlCode: '',
        attempts: 0,
        updated_at: new Date()
      }, { where: { session } });
      
      engine.start(req, res);
      return http.json(res, 200, {
        result: 'success',
        session,
        state: 'STARTING',
        status: 'INITIALIZING'
      });
    } catch (err) {
      customLogger.error('❌ Erro ao iniciar sessão', err);
      return http.fail(res, err, 500, 'Erro ao iniciar sessão');
    }
  }
};
