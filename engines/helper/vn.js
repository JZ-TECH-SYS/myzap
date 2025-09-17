const { Buffer } = require('buffer');
// ✅ REMOVIDO Firebase - agora usa pasta local instances/
const webhooks = require('../../controllers/WebhooksController.js');
const Sessions = require('../../controllers/SessionsController.js');

module.exports = {
  exportQR(req, res, qrCode, session) {
    // ✅ Aceitar base64 vindo com ou sem prefixo e normalizar
    if (!qrCode) {
      console.warn(`${session} - QR Code vazio ou undefined`);
      return;
    }

    let normalized = qrCode;
    if (!normalized.startsWith('data:image')) {
      normalized = 'data:image/png;base64,' + normalized.replace(/^data:[^,]+,/, '');
    }

    const base64Data = normalized.replace('data:image/png;base64,', '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    req.io.emit('qrCode', {
      data: 'data:image/png;base64,' + imageBuffer.toString('base64'),
      session
    });

    console.log(`${session} - QR Code emitido (normalizado=${qrCode !== normalized})`);
  },

  async generateQRHooksAndEmit({ req, res, qrCode, session }) {
    webhooks.wh_qrcode(session, qrCode);
    this.exportQR(req, res, qrCode, session);
    Sessions.addInfoSession(session, { qrCode });
  },

  getBrowserArgs() {
    return [
      '--log-level=3',
      '--no-default-browser-check',
      '--disable-site-isolation-trials',
      '--no-experiments',
      '--ignore-gpu-blacklist',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-default-apps',
      '--enable-features=NetworkService',
      '--disable-setuid-sandbox',
      '--no-sandbox',
      '--disable-webgl',
      '--disable-threaded-animation',
      '--disable-threaded-scrolling',
      '--disable-in-process-stack-traces',
      '--disable-histogram-customizer',
      '--disable-gl-extensions',
      '--disable-composited-antialiasing',
      '--disable-canvas-aa',
      '--disable-3d-apis',
      '--disable-accelerated-2d-canvas',
      '--disable-accelerated-jpeg-decoding',
      '--disable-accelerated-mjpeg-decode',
      '--disable-app-list-dismiss-on-blur',
      '--disable-accelerated-video-decode'
    ];
  },

  getClientOptions() {
    return {
      headless: true,
      logQR: false, // ✅ Desabilitar log no terminal, usar callbacks
      autoClose: 0, // ✅ Desabilitar auto-close para evitar problemas de sessão
      disableSpins: true,
      disableWelcome: true,
      updatesLog: false,
      folderNameToken: './instances', // ✅ PADRONIZADO - usar pasta local
      createPathFileToken: true, // ✅ Habilitar criação de tokens
      useChrome: true,
    browserArgs: this.getBrowserArgs().filter(arg => arg !== '--single-process'), // evitar flag problemática no Windows
      puppeteerOptions: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
      '--no-zygote',
          '--disable-extensions'
        ]
      }
    };
  },

  async getToken(session) {
    // ✅ REMOVIDO Firebase - agora usa pasta local instances/
    // Venom irá salvar tokens automaticamente na pasta instances/
    console.log(`[VENOM TOKEN] ${session} - Usando tokens da pasta instances/`);
    return null; // Deixa Venom gerenciar automaticamente via folderNameToken
  }
};
