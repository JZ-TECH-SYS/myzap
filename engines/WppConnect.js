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
require('dotenv').config();

const Device = DeviceModel(config.sequelize);
const User = UserModel(config.sequelize);
const HOST = process?.env?.HOST;

console.log(`[SERVER] HOST: ${HOST}`);

module.exports = class Wppconnect {
  static async start(req, res) {
    const session = req?.body?.session || '';
    const sessionkey = req.headers['sessionkey'];
    const number = req?.body?.number || '';
    const body = req?.body || [];

    const wh_connect = req?.body?.wh_connect || '';
    const wh_status = req?.body?.wh_status || '';
    const wh_message = req?.body?.wh_message || '';
    const wh_qrcode = req?.body?.wh_qrcode || '';

    console.log('Starting WhatsApp...', { session, sessionkey, number, wh_connect, wh_status, wh_message, wh_qrcode });

    const user = req?.session?.usuario;
    let deviceExist = await Device.findOne({ where: { session } });

    try {
      const payload = {
        userId: user?.id,
        session,
        sessionkey,
        number,
        wh_connect,
        wh_status,
        wh_message,
        wh_qrcode
      };

      if (deviceExist) {
        await deviceExist.update(WppHelper.getPayloadUpdateDevice(payload));
        logger.info('Device updated successfully');
      } else {
        const sysUser = await User.findOne({ where: { email: process.env.EMAIL } });
        await Device.create(WppHelper.getPayloadCreateDevice({ ...payload, userId: sysUser?.id }));
        logger.info('Device created successfully');
      }
    } catch (error) {
      logger.error('Error to create/update device:', error);
      return res?.status(500)?.json({ result: 500, status: 'ERROR', response: error });
    }

    const funcoesSocket = new fnSocket(req.io);
    funcoesSocket.events(session, {
      message: 'Iniciando WhatsApp. Aguarde...',
      state: 'STARTING',
      status: 'INITIALIZING',
      session,
      number
    });
    webhooks?.wh_connect(session, 'INITIALIZING', number, body, { message: 'Iniciando WhatsApp. Aguarde...' });

    req.funcoesSocket = funcoesSocket;
    this.initSession(req, res);
  }

  static async initSession(req, res) {
    const session = req?.body?.session;
    const sessionkey = req.headers['sessionkey'];
    const funcoesSocket = new fnSocket(req.io);
    const options = WppHelper.buildOptions(session);

    try {
      await wppconnect.create({
        session,
        catchQR: async (qr, asciiQR, attempts, urlCode) => {
          await WppHelper.handleCatchQR({
            req, res, qrCode: qr, asciiQR, attempts, urlCode, session, sessionkey
          });
        },
        statusFind: async (statusSession, session) => {
          WppHelper.handleStatusFind(session, statusSession);
        },
        ...options
      }).then(async (wpp) => {
        Sessions?.createClient(session, req, wpp);
        events?.statusConnection(session, wpp, req);
        events?.receiveMessage(session, wpp, req);
        events?.statusMessage(session, wpp, req);

        const wa_version = await wpp.getWAVersion();
        const wa_js_version = await wpp.getWAJSVersion();
        const stateSession = await wpp.getConnectionState();
        const number = await wpp.getWid();
        const host_device = await wpp.getHostDevice();

        await WppHelper.updateDeviceAfterSessionStart({
          session, sessionkey, stateSession, number, host_device, wa_version, wa_js_version
        });

        wpp.onInterfaceChange((i) =>
          WppHelper.handleInterfaceChange(session, i, funcoesSocket)
        );

        wpp.onNotificationMessage((n) =>
          WppHelper.handleNotificationMessage(session, n, funcoesSocket)
        );
      }).catch((error) => {
        logger.error('Error ao criar sessão no browser:', error);
        exec(`rm -rf instances/${session}`);
        return res?.status(500)?.json({ result: 500, status: 'ERROR', response: error });
      });

      wppconnect.defaultLogger.level = 'silly';
    } catch (error) {
      logger.error('Erro fatal, sessão não criada:', error);
      exec(`rm -rf instances/${session}`);
      return res?.status(500)?.json({ result: 500, status: 'ERROR', response: error });
    }
  }
};
