const axios = require('axios');
const moment = require('moment');
const logger = require('../../util/logger.js');

moment.locale('pt-br');

module.exports = {
  async send(url, payload, queue = '') {
    if (!url) return;

    try {
      await axios.post(url, payload, {
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'user-agent': 'MYZAP-API',
          queue
        },
        timeout: 10000
      });
    } catch (error) {
      logger.error(`[WEBHOOK ERROR] ${error.message}`);
    }
  },

  buildConnectPayload(session, state, connection, number = "", body = [], message = null) {
    return {
      wook: 'STATUS_CONNECT',
      result: 200,
      session,
      state,
      status: connection?.status,
      number: number || connection?.number,
      message,
      body
    };
  },

  buildStatusPayload(session, state) {
    return {
      wook: 'STATUS_CONNECTION',
      result: 200,
      session,
      state,
      status: state
    };
  },

  buildQrCodePayload(session, qrcode, attempts, urlCode) {
    return {
      wook: 'QRCODE',
      result: 200,
      session,
      state: 'QRCODE_RECEIVED',
      status: 'awaitReadQrCode',
      qrcode,
      attempts,
      urlCode
    };
  },

  buildCodePayload(session, number, code) {
    return {
      wook: 'CODE',
      result: 200,
      session,
      state: 'CODE_RECEIVED',
      status: 'awaitReadCode',
      code,
      number
    };
  },

  buildIncomingCallPayload(session, callData) {
    return {
      wook: 'INCOMING_CALL',
      id: callData?.id,
      phone: callData?.peerJid,
      offer_time: moment.unix(callData?.offerTime).format('DD-MM-YYYY HH:mm:ss'),
      isVideo: callData?.isVideo,
      isGroup: callData?.isGroup,
      participants: callData?.participants,
      session,
      data: callData
    };
  }
};
