const { Buffer } = require('buffer');
const { doc, db, getDoc } = require('../../firebase/db.js');
const webhooks = require('../../controllers/webhooks.js');
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
      autoClose: 90000,
      disableSpins: false,
      browserArgs: this.getBrowserArgs(),
      createPathFileToken: false
    };
  },

  async getToken(session) {
    const Session = doc(db, 'Sessions', session);
    const dados = await getDoc(Session);
    if (dados.exists() && dados.data()?.Engine === process.env.ENGINE) {
      return {
        WABrowserId: dados.data().WABrowserId,
        WASecretBundle: dados.data().WASecretBundle,
        WAToken1: dados.data().WAToken1,
        WAToken2: dados.data().WAToken2,
        Engine: process.env.ENGINE
      };
    }
    return null;
  }
};
