const chalk = require('chalk');
const webhooks = require('../../controllers/WebhooksController.js');
const Sessions = require('../../controllers/SessionsController.js');

module.exports = {
  exportQR(req, res, qrCode, urlCode, attempts, asciiQR, session) {
    req?.io?.emit('qrcode', {
      message: 'QRCode Iniciando, faça a leitura para autenticar...',
      state: 'QRCODE',
      qrCode: qrCode || '',
      attempt: attempts || '',
      session: session || '',
    });

    req?.io?.emit('events', {
      message: 'QRCode Iniciando, esse evento será descontinuado em breve, utilize o evento qrcode',
      state: 'QRCODE',
      qrCode: qrCode || '',
      asciiQR: asciiQR || '',
      attempt: attempts || '',
      urlCode: urlCode || '',
      session: session || '',
    });
  },

  async handleCatchQR({ req, res, qrCode, asciiQR, attempts, urlCode, session, sessionkey }) {
    this.exportQR(req, res, qrCode, urlCode, attempts, asciiQR, session);
    try {
      const DeviceModel = require('../../Models/device.js');
      const config = require('../../config.js');
      const Device = DeviceModel(config.sequelize);
      await Device.update(this.updateDevice(qrCode, attempts, urlCode), {
        where: { sessionkey, session }
      });
    } catch (error) {
      console.error('Error to update device:', error);
    }
    webhooks?.wh_qrcode(session, qrCode, attempts, urlCode);
  },

  browserArgs: [
    '--disable-web-security',
    '--no-sandbox',
    '--aggressive-cache-discard',
    '--disable-cache',
    '--disable-application-cache',
    '--disable-offline-load-stale-cache',
    '--disk-cache-size=0',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-first-run',
    '--safebrowsing-disable-auto-update',
    '--ignore-certificate-errors',
    '--ignore-ssl-errors',
    '--ignore-certificate-errors-spki-list',
    '--disable-features=LeakyPeeker'
  ],

  buildOptions(session) {
    return {
      headless: process.env.HEADLESS ? false : 'new',
      devtools: false,
      debug: true,
      logQR: !!process.env.HOST,
      updatesLog: !!process.env.HOST,
      useChrome: false,
      autoClose: 120000,
      disableWelcome: true,
      deviceSyncTimeout: 980000,
      whatsappVersion: process.env.WHATSAPP_VERSION,
      folderNameToken: './instances',
      puppeteerOptions: {
        userDataDir: `instances/${session}`,
      },
      browserArgs: this.browserArgs
    };
  },

  logSessionStatus(session, statusSession) {
    console.log(chalk.red(`[SESSION] ${chalk.bold.red(session)} - ${chalk.bold.red(`Status: ${statusSession}`)}`));
  },

  handleStatusFind(session, statusSession) {
    this.logSessionStatus(session, statusSession);
  },

  updateDevice(qrCode, attempts, urlCode) {
    return {
      state: 'QRCODE',
      status: 'qrCode',
      qrCode,
      attempts,
      urlCode,
      updated_at: new Date()
    };
  },

  async updateDeviceAfterSessionStart({ session, sessionkey, stateSession, number, host_device, wa_version, wa_js_version }) {
    const DeviceModel = require('../../Models/device.js');
    const config = require('../../config.js');
    const Device = DeviceModel(config.sequelize);

    await Device.update({
      state: stateSession,
      qrCode: '',
      attempts: 0,
      urlCode: '',
      last_connect: new Date(),
      number,
      battery: host_device?.battery,
      platform: host_device?.platform,
      pushname: host_device?.pushname,
      wa_version,
      wa_js_version,
      updated_at: new Date()
    }, { where: { sessionkey, session } });
  },

  async handleInterfaceChange(session, i, funcoesSocket) {
    await webhooks?.wh_messages(session, {
      wook: 'INTERFACE_CHANGED',
      result: 200,
      session,
      message: { message: `${session} is ${i?.displayInfo} mode ${i?.mode}` },
      body: { ...i }
    });

    funcoesSocket?.interface(session, {
      message: `${session} is ${i?.displayInfo} mode ${i?.mode}`,
      state: 'INTERFACE_CHANGED',
      session
    });
  },

  async handleNotificationMessage(session, notification, funcoesSocket) {
    await webhooks?.wh_messages(session, {
      wook: 'NOTIFICATION_MESSAGE',
      session,
      notification,
      data: { notification }
    });

    funcoesSocket?.events(session, {
      message: 'NOTIFICATION_MESSAGE',
      state: 'NOTIFICATION_MESSAGE',
      notification,
      session
    });
  },

  getPayloadUpdateDevice({ userId, session, sessionkey, number, wh_connect, wh_status, wh_message, wh_qrcode }) {
    return {
      user_id: userId,
      session,
      sessionkey,
      qrCode: '',
      attempts: 0,
      urlCode: '',
      attempts_start: 0,
      last_start: new Date(),
      state: 'STARTING',
      status: 'notLogged',
      number,
      wh_qrcode,
      wh_connect,
      wh_status,
      wh_message,
      updated_at: new Date()
    };
  },

  getPayloadCreateDevice(params) {
    const base = this.getPayloadUpdateDevice(params);
    return {
      ...base,
      created_at: new Date()
    };
  }
};
