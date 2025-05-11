
const wppconnect = require('@wppconnect-team/wppconnect');
const Sessions = require('../controllers/SessionsController.js');
const events = require('../controllers/EventsController.js');
const webhooks = require('../controllers/WebhooksController.js');
const fnSocket = require('../controllers/FNSocketsController.js');
const { exec } = require('child_process');
const config = require('../config.js');
const DeviceModel = require('../Models/device.js');
const UserModel = require('../Models/user.js');
const logger = require('../util/logger.js');
const WppHelper = require('./helper/wpp');
const DeviceCompanyModel = require('../Models/deviceCompany.js');
const DeviceCompany = DeviceCompanyModel(config.sequelize);

require('dotenv').config();

const Device = DeviceModel(config.sequelize);
const User = UserModel(config.sequelize);

module.exports = class Wppconnect {
  /**
   * Endpoint /start
   * - garante linha na tabela device
   * - dispara initSession
   */
  static async start(req, res) {
    const session = req?.body?.session || '';
    const sessionkey = req.headers['sessionkey'];
    const number = req?.body?.number || '';
    const body = req?.body || [];

    const wh_connect = req?.body?.wh_connect || '';
    const wh_status = req?.body?.wh_status || '';
    const wh_message = req?.body?.wh_message || '';
    const wh_qrcode = req?.body?.wh_qrcode || '';

    logger.info('Starting WhatsApp…', { session, sessionkey, number });

    try {
      // cria / atualiza device
      const { empresa_nome, api_url } = body;
      const sysUser = await User.findOne({ where: { email: process.env.EMAIL } });
      const payload = WppHelper.getPayloadCreateDevice({
        userId: sysUser?.id,
        session, sessionkey, number,
        wh_connect, wh_status, wh_message, wh_qrcode
      });
      await Device.upsert(payload, { conflictFields: ['session'] });
      if (empresa_nome && api_url) {
        await DeviceCompany.upsert({
          session,
          sessionkey,
          empresa_nome,
          api_url
        }, { conflictFields: ['session'] });
      }
    } catch (err) {
      console.log('Erro ao criar/atualizar device', err);
      logger.error('Erro ao criar/atualizar device', err);
      return res?.status(500)?.json({ result: 500, status: 'ERROR', response: err });
    }

    // socket + webhook
    const socketFns = new fnSocket(req.io);
    socketFns.events(session, {
      message: 'Iniciando WhatsApp. Aguarde…',
      state: 'STARTING',
      status: 'INITIALIZING',
      session, number
    });
    webhooks?.wh_connect(session, 'INITIALIZING', number, body, { message: 'Iniciando WhatsApp. Aguarde…' });

    req.funcoesSocket = socketFns;

    // cria sessão
    this.initSession(req, res);
  }

  /**
   * Instancia o cliente WPPConnect e registra todos os callbacks
   */
  static async initSession(req, res) {
    const session = req?.body?.session;
    const sessionkey = req.headers['sessionkey'];
    const io = req.io;
    const options = WppHelper.buildOptions(session);

    try {
      await wppconnect.create({
        session,
        catchQR: (qr, asciiQR, attempts, urlCode) =>
          WppHelper.handleCatchQR({
            req, res, qrCode: qr, asciiQR, attempts, urlCode,
            session, sessionkey
          }),
        statusFind: (statusSession, _sess) =>
          WppHelper.handleStatusFind(_sess, statusSession, { sessionkey, io }),
        ...options
      }).then(async (client) => {
        client.onStateChange((state) =>
          WppHelper.handleStateChange(session, state, { sessionkey, io })
        );

        client.onInterfaceChange((iface) =>
          WppHelper.handleInterfaceChange(session, iface, req.funcoesSocket)
        );

        client.onNotificationMessage((n) =>
          WppHelper.handleNotificationMessage(session, n, req.funcoesSocket)
        );

        // salva refs
        Sessions?.createClient(session, req, client);
        events?.statusConnection(session, client, req);
        events?.receiveMessage(session, client, req);
        events?.statusMessage(session, client, req);

        // infos do host
        const wa_version = await client.getWAVersion();
        const wa_js_version = await client.getWAJSVersion();
        const stateSession = await client.getConnectionState();
        const number = await client.getWid();
        const host_device = await client.getHostDevice();

        await WppHelper.updateDeviceAfterSessionStart({
          session, sessionkey, stateSession,
          number, host_device, wa_version, wa_js_version
        });

        logger.info(`[${session}] READY - ${stateSession}`);
      }).catch((err) => {
        logger.error('Erro ao criar sessão no browser', err);
        exec(`rm -rf instances/${session}`);
        return res?.status(500)?.json({ result: 500, status: 'ERROR', response: err });
      });

      wppconnect.defaultLogger.level = 'silly';
    } catch (err) {
      logger.error('Erro fatal, sessão não criada', err);
      exec(`rm -rf instances/${session}`);
      return res?.status(500)?.json({ result: 500, status: 'ERROR', response: err });
    }
  }
};
