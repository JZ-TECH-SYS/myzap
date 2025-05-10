const { doc, db, getDoc } = require('../firebase/db.js');
const { Client } = require('whatsapp-web.js');
const Launcher = require('chrome-launcher');
const Sessions = require('../controllers/SessionsController.js');
const events = require('../controllers/EventsController.js');
const webhooks = require('../controllers/WebhooksController.js');
const config = require('../config.js');
const HelperWhatsappWeb = require('./helper/wweb.js');

let chromeLauncher = Launcher.Launcher.getInstallations()[0];

module.exports = class WhatsappWebJS {
  static async start(req, res, session) {
    return new Promise(async (resolve, reject) => {
      try {
        const useHere = config.useHere !== 'true';

        console.log(useHere);
        let client;

        const Session = doc(db, 'Sessions', session);
        const dados = await getDoc(Session);

        const shouldUseSessionData = dados.exists() && dados.data().engine === process.env.ENGINE;
        const sessionData = shouldUseSessionData ? dados.data() : null;

        console.log(`****** STARTING SESSION ${session} ******`);

        const clientOptions = HelperWhatsappWeb.getClientOptions({
          session,
          useHere,
          sessionData
        });

        client = new Client(clientOptions);

        if (!shouldUseSessionData) {
          client.on('qr', async (qr) => {
            await HelperWhatsappWeb.generateQRHooksAndEmit({ qr, req, res, session });
          });
        }

        client.on('ready', () => {
          req.io.emit('whatsapp-status', true);
          console.log('READY... WhatsApp is ready');
        });

        client.on('auth_failure', () => {
          console.log('Auth failure, restarting...');
        });

        client.initialize();

        Sessions.addInfoSession(session, {
          session,
          client
        });

        events.receiveMessage(session, client);
        events.statusMessage(session, client);

        client.on('authenticated', (session) => {
          resolve(session);
        });

        client.on('change_state', (reason) => {
          console.log('Client was change state', reason);
          webhooks.wh_connect(session, reason);
        });

        client.on('disconnected', (reason) => {
          console.log('Whatsapp is disconnected!');
          client.destroy();
          client.initialize();
        });

        client.on('change_battery', (batteryInfo) => {
          const { battery, plugged } = batteryInfo;
          console.log(`Battery: ${battery}% - Charging? ${plugged}`);
        });

        client.on('message', async () => {});
        client.on('message_received', async () => {});
        client.on('message_ack', () => {});
        client.on('message_create', async (message) => {
          if (!message.fromMe) {
            // Exemplo: webhook customizado
          }
        });

        client.on('message_revoke_everyone', async (after, before) => {
          if (before) {
            // Log antes de deletar
          }
        });

        client.on('message_revoke_me', async () => {});
        client.on('media_uploaded', async () => {});
        client.on('group_update', async () => {});
      } catch (error) {
        reject(error);
        console.log(error);
      }
    });
  }
};
