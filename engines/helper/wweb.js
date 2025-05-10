const { Buffer } = require('buffer');
const qrcodeTerminal = require('qrcode-terminal');
const qrcodeBase64 = require('qrcode');
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

  showTerminalQR(qr) {
    console.log('QR RECEIVED');
    qrcodeTerminal.generate(qr, { small: true });
  },

  async generateQRHooksAndEmit({ qr, req, res, session }) {
    this.showTerminalQR(qr);
    qrcodeBase64.toDataURL(qr, (err, url) => {
      webhooks.wh_qrcode(session, url);
      this.exportQR(req, res, url, session);
      Sessions.addInfoSession(session, { qrCode: url });
    });
  },

  getClientOptions({ session, useHere, sessionData }) {
    const base = {
      restartOnAuthFail: true,
      takeoverOnConflict: useHere,
      puppeteer: {
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    };

    if (sessionData) {
      base.session = {
        WABrowserId: sessionData.WABrowserId,
        WASecretBundle: sessionData.WASecretBundle,
        WAToken1: sessionData.WAToken1,
        WAToken2: sessionData.WAToken2,
        engine: process.env.ENGINE
      };
    }

    return base;
  }
};
