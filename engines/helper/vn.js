const { Buffer } = require('buffer');
// ✅ REMOVIDO Firebase - agora usa pasta local instances/
const webhooks = require('../../controllers/WebhooksController.js');
const Sessions = require('../../controllers/SessionsController.js');

module.exports = {
  exportQR(req, res, qrCode, session) {
    qrCode = qrCode.replace('data:image/png;base64,', '');
    const imageBuffer = Buffer.from(qrCode, 'base64');
    req.io.emit('qrCode', {
      data: 'data:image/png;base64,' + imageBuffer.toString('base64'),
      session
    });
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
      logQR: true,
      browserWS: '',
      useChrome: true,
      updatesLog: true,
      autoClose: 120000, // Aumentado para 2 minutos para melhor estabilidade
      disableSpins: false,
      disableWelcome: true, // Baseado na documentação para containers
      folderNameToken: './instances', // ✅ PADRONIZADO - usar pasta local
      browserArgs: this.getBrowserArgs(),
      createPathFileToken: false,
      // Opções adicionais baseadas na documentação oficial
      devtools: false,
      debug: false,
      puppeteerOptions: {
        // Opções específicas do Puppeteer para melhor estabilidade
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
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
