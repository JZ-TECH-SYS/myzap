const webhooks = require('./WebhooksController.js');
const logger = require('../util/logger.js');
const config = require('../config.js');
const moment = require('moment');
moment.locale('pt-br');

const DeviceModel = require('../Models/device.js');
const Device = DeviceModel(config.sequelize);

const events = require('../controllers/helper/events.js');

module.exports = class Events {
  static async receiveMessage(session, client, req) {
    await client?.onAnyMessage(async message => {
      if (!events.isPermitido(message)) {
        console.log('Tipo de mensagem não permitido:', message?.type);
        return req.funcoesSocket.events(session, message);
      }

      const response = await events.montarPayload(message, session, client);

      if (message?.fromMe) {
        req.funcoesSocket.messagesent(session, response);
      } else {
        req.funcoesSocket.message(session, response);
      }

      await webhooks?.wh_messages(session, response);
      req.funcoesSocket.events(session, message);
    });
  }

  static statusMessage(session, client, req) {
    client?.onAck(async ack => {
      const type = events.normalizarTipo(ack);
      const status = events.tipoAckToStatus(ack?.ack);

      const response = {
        wook: 'MESSAGE_STATUS',
        status,
        type,
        id: ack?.id?._serialized,
        from: ack?.from?.split('@')[0],
        to: ack?.to?.split('@')[0],
        session,
        dateTime: events.formatarData(ack?.t),
        data: ack
      };

      req.funcoesSocket.ack(session, response);
      await webhooks?.wh_messages(session, response);
    });
  }

  static async statusConnection(session, client, req) {
    client?.onStateChange(async (state) => {
      console.log('State changed', state);
      await Device.update(
        { state, updated_at: moment().format('YYYY-MM-DD HH:mm:ss') },
        { where: { session } }
      );

      if (state === 'OPENING') logger.info(`[SESSION] ${session} - Abrindo navegador.`);
      if (state === 'PAIRING') logger.info(`[SESSION] ${session} - Lendo o QRCode.`);
      if (state === 'CONFLICT') {
        client?.useHere();
        logger.info(`[SESSION] ${session} - Conflito de login.`);
      }
      if (state === 'UNPAIRED') {
        await Device.destroy({ where: { session } });
      }
      if (state === 'TIMEOUT') {
        client?.startPhoneWatchdog(15000);
        client?.stopPhoneWatchdog(15000);
      }
    });
  }
};
