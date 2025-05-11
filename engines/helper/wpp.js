
/**
 * Helper central para a engine WPPConnect.
 * Mantém toda a lógica de persistência e comunicação (banco, socket, webhooks).
 */
const chalk     = require('chalk');
const { exec }  = require('child_process');
const webhooks  = require('../../controllers/WebhooksController.js');
const fnSocket  = require('../../controllers/FNSocketsController.js');
const config    = require('../../config.js');
const Device    = require('../../Models/device.js')(config.sequelize);

const now = () => new Date();

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */
const emitSocket = (io, session, payload) => {
  const sock = new fnSocket(io);
  sock.events(session, payload);
};

/* -------------------------------------------------------------------------- */
/* QRCode ------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
function exportQR(req, qrCode, urlCode, attempts, asciiQR, session) {
  const payload = {
    message : 'QRCode gerado. Leia para autenticar…',
    state   : 'QRCODE',
    qrCode,
    asciiQR,
    attempt : attempts,
    urlCode,
    session
  };
  req?.io?.emit('qrcode', payload);
  req?.io?.emit('events',  { ...payload, message: 'Evento `events` será descontinuado; use `qrcode`.' });
}

async function handleCatchQR({ req, res, qrCode, asciiQR, attempts, urlCode, session, sessionkey }) {
  exportQR(req, qrCode, urlCode, attempts, asciiQR, session);

  await Device.update({
    state   : 'QRCODE',
    status  : 'qrCode',
    qrCode,
    attempts,
    urlCode,
    updated_at: now()
  }, { where: { sessionkey, session }});

  webhooks?.wh_qrcode(session, qrCode, attempts, urlCode);
}

/* -------------------------------------------------------------------------- */
/* statusFind – atualiza estado da sessão ----------------------------------- */
/* -------------------------------------------------------------------------- */
async function handleStatusFind(session, statusSession, { sessionkey, io }) {
  logSessionStatus(session, statusSession);

  const where = { sessionkey, session };

  switch (statusSession) {
    case 'inChat':
      await Device.update({
        state        : 'CONNECTED',
        status       : 'inChat',
        qrCode       : '', attempts: 0, urlCode: '',
        last_connect : now(), updated_at: now()
      }, { where });

      emitSocket(io, session, {
        message: 'Cliente conectado.',
        state  : 'CONNECTED',
        status : 'inChat',
        session
      });

      webhooks?.wh_connect(session, 'CONNECTED');
      break;

    case 'browserClose':
    case 'serverClose':
    case 'autocloseCalled':
    case 'phoneNotConnected':
      await Device.update({
        state          : 'DISCONNECTED',
        status         : statusSession,
        last_disconnect: now(), updated_at: now()
      }, { where });

      emitSocket(io, session, {
        message: 'Cliente desconectado.',
        state  : 'DISCONNECTED',
        status : statusSession,
        session
      });

      webhooks?.wh_connect(session, statusSession);
      break;

    case 'qrReadError':
    case 'qrReadFail':
      await Device.destroy({ where });
      exec(`rm -rf instances/${session}`);

      emitSocket(io, session, {
        message: 'Falha ao ler QRCode.',
        state  : 'DISCONNECTED',
        status : statusSession,
        session
      });

      webhooks?.wh_connect(session, statusSession);
      break;

    default:
      // Outros status apenas log
      break;
  }
}

/* -------------------------------------------------------------------------- */
/* Outros eventos                                                             */
/* -------------------------------------------------------------------------- */
async function handleStateChange(session, state, { sessionkey, io }) {
  await Device.update({ state, updated_at: now() }, { where: { sessionkey, session } });
  emitSocket(io, session, { message: `State → ${state}`, state, session });
}

async function handleInterfaceChange(session, iface, funcoesSocket) {
  webhooks?.wh_messages(session, {
    wook    : 'INTERFACE_CHANGED',
    result  : 200,
    session,
    message : { message: `${session} is ${iface?.displayInfo} mode ${iface?.mode}` },
    body    : iface
  });

  funcoesSocket?.interface(session, {
    message: `${session} is ${iface?.displayInfo} mode ${iface?.mode}`,
    state  : 'INTERFACE_CHANGED',
    session
  });
}

async function handleNotificationMessage(session, notification, funcoesSocket) {
  webhooks?.wh_messages(session, {
    wook : 'NOTIFICATION_MESSAGE',
    session,
    notification,
    data: { notification }
  });

  funcoesSocket?.events(session, {
    message: 'NOTIFICATION_MESSAGE',
    state  : 'NOTIFICATION_MESSAGE',
    notification,
    session
  });
}

/* -------------------------------------------------------------------------- */
/* Após conexão ------------------------------------------------------------- */
async function updateDeviceAfterSessionStart({ session, sessionkey, stateSession, number, host_device, wa_version, wa_js_version }) {
  await Device.update({
    state         : stateSession,
    qrCode        : '',
    attempts      : 0,
    urlCode       : '',
    last_connect  : now(),
    number,
    battery       : host_device?.battery,
    platform      : host_device?.platform,
    pushname      : host_device?.pushname,
    wa_version,
    wa_js_version,
    updated_at    : now()
  }, { where: { sessionkey, session } });
}

/* -------------------------------------------------------------------------- */
/* Payload helpers ---------------------------------------------------------- */
function getPayloadUpdateDevice({
  userId, session, sessionkey, number,
  wh_connect, wh_status, wh_message, wh_qrcode
}) {
  return {
    user_id: userId,
    session,
    sessionkey,
    qrCode        : '',
    attempts      : 0,
    urlCode       : '',
    attempts_start: 0,
    last_start    : now(),
    state         : 'STARTING',
    status        : 'notLogged',
    number,
    wh_qrcode,
    wh_connect,
    wh_status,
    wh_message,
    updated_at    : now()
  };
}

function getPayloadCreateDevice(params) {
  return { ...getPayloadUpdateDevice(params), created_at: now() };
}

/* -------------------------------------------------------------------------- */
/* Options                                                                    */
function buildOptions(session) {
  return {
    headless         : process.env.HEADLESS ? false : 'new',
    devtools         : false,
    debug            : true,
    logQR            : !!process.env.HOST,
    updatesLog       : !!process.env.HOST,
    useChrome        : false,
    autoClose        : 120000,
    disableWelcome   : true,
    deviceSyncTimeout: 980000,
    whatsappVersion  : process.env.WHATSAPP_VERSION,
    folderNameToken  : './instances',
    puppeteerOptions : { userDataDir: `instances/${session}` },
    browserArgs      : [
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
    ]
  };
}

/* -------------------------------------------------------------------------- */
/* Logging helper                                                             */
function logSessionStatus(session, statusSession) {
  console.log(chalk.red(`[SESSION] ${chalk.bold.red(session)} - ${chalk.bold.red(`Status: ${statusSession}`)}`));
}

/* -------------------------------------------------------------------------- */
/* Exports                                                                    */
module.exports = {
  exportQR,
  handleCatchQR,
  handleStatusFind,
  handleStateChange,
  handleInterfaceChange,
  handleNotificationMessage,
  updateDeviceAfterSessionStart,
  getPayloadUpdateDevice,
  getPayloadCreateDevice,
  buildOptions,
  logSessionStatus
};
