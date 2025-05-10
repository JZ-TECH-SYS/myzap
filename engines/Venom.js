const venom = require('venom-bot');
const Sessions = require('../controllers/SessionsController.js');
const events = require('../controllers/events.js');
const webhooks = require('../controllers/webhooks.js');
const config = require('../config.js');
const VenomHelper = require('./helper/vn.js');

module.exports = class Venom {
  static async start(req, res, session) {
    const token = await VenomHelper.getToken(session);
    console.log(token);

    try {
      const client = await venom.create(
        session,
        (qrCode, asciiQR, attempts, urlCode) => {
          VenomHelper.generateQRHooksAndEmit({ req, res, qrCode, session });
        },
        (statusSession) => {
          console.log(statusSession);
          Sessions.addInfoSession(session, { status: statusSession });

          if (statusSession !== 'qrReadSuccess') {
            webhooks.wh_connect(session, statusSession);
          }

          const onlineStatuses = ['isLogged', 'qrReadSuccess', 'chatsAvailable', 'inChat'];
          const offlineStatuses = ['browserClose', 'qrReadFail', 'autocloseCalled', 'serverClose'];

          if (offlineStatuses.includes(statusSession)) {
            req.io.emit('whatsapp-status', false);
          }

          if (onlineStatuses.includes(statusSession)) {
            req.io.emit('whatsapp-status', true);
          }
        },
        VenomHelper.getClientOptions(),
        token || {}
      );

      const info = await client.getHostDevice();
      const tokens = await client.getSessionTokenBrowser();

      webhooks.wh_connect(session, 'connected', info, [], tokens);

      events.receiveMessage(session, client);
      events.statusMessage(session, client);

      if (config.useHere === 'true') {
        events.statusConnection(session, client);
      }

      Sessions.addInfoSession(session, {
        client,
        tokens
      });

      return client, tokens;
    } catch (error) {
      console.log(error);
    }
  }

  static async stop(session) {
    const data = Sessions.getSession(session);
    const response = await data.client.close();
    return !!response;
  }
};
