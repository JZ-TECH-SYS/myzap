
/**
 * Helper central para a engine WPPConnect.
 * Mantém toda a lógica de persistência e comunicação (banco, socket, webhooks).
 */
const chalk     = require('chalk');
const qrcodeBase64 = require('qrcode'); // 🚀 PARA CONVERTER QR CODE TEXTO EM IMAGEM BASE64
const stealth   = require('./stealth'); // NOVO: Sistema anti-detecção
const webhooks  = require('../../controllers/WebhooksController.js');
const fnSocket  = require('../../controllers/FNSocketsController.js');
const config    = require('../../config.js');
const Device    = require('../../Models/device.js')(config.sequelize);
const customLogger = require('../../util/customLogger');

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

// Cache em memória para disponibilizar QR imediatamente às rotas antes de persistência / polling
const __qrCache = global.__wppQrCache || (global.__wppQrCache = new Map());

function setQrCache(session, data){
  __qrCache.set(session, { ...data, cachedAt: Date.now() });
}

function getQrCache(session){
  const entry = __qrCache.get(session);
  if(!entry) return null;
  // Expira após 2 minutos
  if(Date.now() - entry.cachedAt > 120000){
    __qrCache.delete(session);
    return null;
  }
  return entry;
}

async function handleCatchQR({ req, res, qrCode, asciiQR, attempts, urlCode, session, sessionkey }) {
  // WPPConnect já fornece o conteúdo (string longa). Algumas versões novas geram códigos maiores
  // que estouram a capacidade da lib 'qrcode' → então salvamos e emitimos o valor bruto.
  const whereClause = sessionkey ? { sessionkey, session } : { session };

  exportQR(req, qrCode, urlCode, attempts, asciiQR, session);
  req?.io?.emit('qrcode_raw', { session, qrRaw: qrCode, isBase64: false });
  setQrCache(session, { qrCode, urlCode, attempts, asciiQR });

  await Device.update({
    state   : 'QRCODE',
    status  : 'qrCode',
    qrCode,           // conteúdo bruto
    attempts,
    urlCode,
    updated_at: now()
  }, { where: whereClause });

  // Também registra no SessionsController (memória), espelhando lógica do WebJS
  try {
    const Sessions = require('../../controllers/SessionsController.js');
    await Sessions.addInfoSession(session, { status: 'qrCode', qrCode });
  } catch(err){ /* ignore */ }

  try { webhooks?.wh_qrcode(session, qrCode, attempts, urlCode, { isBase64: false }); } catch(_) {}
  customLogger.info(`[WPPConnect] QR bruto salvo (len=${qrCode?.length}) - ${session}`);
}

/* -------------------------------------------------------------------------- */
/* statusFind – atualiza estado da sessão ----------------------------------- */
/* -------------------------------------------------------------------------- */
async function handleStatusFind(session, statusSession, { sessionkey, io }) {
  logSessionStatus(session, statusSession);

  const where = { sessionkey, session };

  switch (statusSession) {
    case 'inChat':
    case 'isLogged':
    case 'CONNECTED':
      // ✅ LOG DE RECONEXÃO AUTOMÁTICA
      const device = await Device.findOne({ where });
      if (device && device.status !== 'inChat') {
        customLogger.success(`🎉 RECONEXÃO AUTOMÁTICA BEM-SUCEDIDA: ${session} - Era: ${device.status} → Agora: inChat`);
      }

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

    case 'qrReadSuccess':
    case 'qrRead':
      // QR Code foi lido, aguardando conexão
      await Device.update({
        state      : 'CONNECTING',
        status     : 'qrRead',
        updated_at : now()
      }, { where });

      emitSocket(io, session, {
        message: 'QR Code lido, conectando...',
        state  : 'CONNECTING',
        status : 'qrRead',
        session
      });
      break;

    case 'browserClose':
    case 'serverClose':
    case 'autocloseCalled':
    case 'phoneNotConnected':
    case 'desconnectedMobile':
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
      
      // Remove diretório da sessão de forma compatível com Windows
      try {
        const fs = require('fs');
        const path = require('path');
        const sessionPath = path.join('instances', session);
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
      } catch (rmErr) {
        console.error('Erro ao remover diretório da sessão:', rmErr);
      }

      emitSocket(io, session, {
        message: 'Falha ao ler QRCode.',
        state  : 'DISCONNECTED',
        status : statusSession,
        session
      });

      webhooks?.wh_connect(session, statusSession);
      break;

    case 'notLogged':
      // Status específico para quando não conseguiu fazer login
      // Baseado no issue #2489 - limpa tokens corrompidos e força novo QR
      customLogger.whatsapp(`⚠️ notLogged detectado para sessão ${session} - limpando tokens e forçando novo QR`);
      
      // Limpa tokens corrompidos
      try {
        const fs = require('fs');
        const path = require('path');
        const tokensPath = path.join('instances', session, 'tokens');
        if (fs.existsSync(tokensPath)) {
          fs.rmSync(tokensPath, { recursive: true, force: true });
          customLogger.whatsapp(`🧹 Tokens removidos para sessão ${session}`);
        }
      } catch (tokenErr) {
        console.error('Erro ao remover tokens:', tokenErr);
      }

      await Device.update({
        state          : 'DISCONNECTED',
        status         : 'notLogged',
        qrCode         : '',
        attempts       : 0,
        urlCode        : '',
        last_disconnect: now(),
        updated_at     : now()
      }, { where });

      emitSocket(io, session, {
        message: 'Falha na autenticação. Gerando novo QR Code...',
        state  : 'DISCONNECTED',
        status : 'notLogged',
        session
      });

      webhooks?.wh_connect(session, 'notLogged');
      break;

    default:
      // Log para status não tratados
      console.log(`[WPP] Status não tratado: ${statusSession} para sessão ${session}`);
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
/* cleanBrowserCache – limpa cache do navegador para reconexões ------------ */
/* -------------------------------------------------------------------------- */
async function cleanBrowserCache(session) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const sessionPath = path.join('instances', session);
    const cachePaths = [
      path.join(sessionPath, 'Default', 'Cache'),
      path.join(sessionPath, 'Default', 'Code Cache'),
      path.join(sessionPath, 'Default', 'GPUCache'),
      path.join(sessionPath, 'Default', 'Service Worker'),
      path.join(sessionPath, 'ShaderCache'),
      path.join(sessionPath, 'Default', 'blob_storage'),
      path.join(sessionPath, 'Default', 'File System')
    ];
    
    customLogger.info(`🧹 [CACHE CLEANUP] ${session} - Limpando cache do navegador para reconexão`);
    
    for (const cachePath of cachePaths) {
      if (fs.existsSync(cachePath)) {
        try {
          fs.rmSync(cachePath, { recursive: true, force: true });
          customLogger.info(`✅ [CACHE CLEANUP] ${session} - Cache removido: ${path.basename(cachePath)}`);
        } catch (error) {
          customLogger.warning(`⚠️ [CACHE CLEANUP] ${session} - Falha ao remover: ${path.basename(cachePath)}`);
        }
      }
    }
    
    return true;
  } catch (error) {
    customLogger.error(`❌ [CACHE CLEANUP] ${session} - Erro: ${error.message}`);
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* cleanCorruptedSession – limpa sessões corrompidas ----------------------- */
/* -------------------------------------------------------------------------- */
async function cleanCorruptedSession(session) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const sessionPath = path.join('instances', session);
    const tokenFiles = [
      path.join(sessionPath, 'tokens', 'session.data.json'),
      path.join(sessionPath, 'tokens', 'session-data.json'),
      path.join(sessionPath, 'Default', 'Local Storage'),
      path.join(sessionPath, 'Default', 'Session Storage'),
      path.join(sessionPath, 'Default', 'IndexedDB')
    ];
    
    // Verifica se há arquivos corrompidos ou inconsistentes
    let hasCorruption = false;
    
    for (const filePath of tokenFiles) {
      if (fs.existsSync(filePath)) {
        try {
          if (filePath.includes('.json')) {
            const content = fs.readFileSync(filePath, 'utf8');
            JSON.parse(content); // Tenta fazer parse para verificar se não está corrompido
          }
        } catch (error) {
          console.log(`[WPP] Arquivo corrompido detectado: ${filePath}`);
          hasCorruption = true;
          break;
        }
      }
    }
    
    // Se detectou corrupção, limpa a sessão
    if (hasCorruption) {
      console.log(`[WPP] Limpando sessão corrompida: ${session}`);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[WPP] Erro ao verificar sessão ${session}:`, error);
    return false;
  }
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
/* Options STEALTH                                                           */
function buildOptions(session) {
  customLogger.info(`[STEALTH] Configurando sessão ${session} com modo anti-detecção`);
  
  // Usa configuração stealth completa
  const stealthConfig = stealth.getStealthConfig(session);
  
  customLogger.info(`[STEALTH] Sessão ${session} configurada - Timeout: INFINITO, Headless: FALSE, SlowMo: ATIVO`);
  
  return stealthConfig;
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
  getQrCache,
  setQrCache,
  handleStatusFind,
  handleStateChange,
  handleInterfaceChange,
  handleNotificationMessage,
  updateDeviceAfterSessionStart,
  getPayloadUpdateDevice,
  getPayloadCreateDevice,
  buildOptions,
  logSessionStatus,
  cleanCorruptedSession,
  cleanBrowserCache
};
