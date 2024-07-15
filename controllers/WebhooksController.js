const Sessions = require('./SessionsController');

const moment = require('moment');
const axios = require('axios');
const logger = require('../util/logger');

require('dotenv').config();

moment().format('DD-MM-YYYY HH:mm:ss');
moment().locale('pt-br');

module.exports = class Webhooks {

    static async sendWebhook(webhookUrl, data, queue) {
        
        try {
        
            await axios.post(webhookUrl, data, {
                headers: {
					'content-type': 'application/json',
					'accept': 'application/json',
					'user-agent': 'MYZAP-API',
                    'queue': queue,
				},
                timeout: 10000
            });
        
        } catch (error) {

            logger.error(`[WEBHOOK] ${error.message, error.stack}`);
            
        }
    }

    static async wh_messages(session, response) {
        
        const webhook = await Sessions.getClient(session);

        if (webhook?.wh_message) {
            await this.sendWebhook(webhook.wh_message, response, 'messages');
        }
    }

    static async wh_connect(session, response, number = "", body = [], message = null) {

        const connection = await Sessions.getClient(session);

        const object = {
            wook: 'STATUS_CONNECT',
            result: 200,
            session,
            state: response,
            status: connection?.status,
            number: number !== "" ? number : connection?.number,
            message,
            body
        };

        if (connection?.wh_connect) {
            await this.sendWebhook(connection.wh_connect, object, 'connection');
        }
    }

    static async wh_status(session, response) {

        const webhook = await Sessions.getClient(session);

        const object = {
            wook: 'STATUS_CONNECTION',
            result: 200,
            session,
            state: response,
            status: response
        };
        
        if (webhook?.wh_status) {
            await this.sendWebhook(webhook.wh_status, object, 'status');
        }
    }

    static async wh_qrcode(session, qrcode, attempts, urlCode) {

        const webhook = await Sessions.getClient(session);

        const object = {
            wook: 'QRCODE',
            result: 200,
            session,
            state: 'QRCODE_RECEIVED',
            status: 'awaitReadQrCode',
            qrcode: qrcode,
            attempts,
            urlCode
        };

        if (webhook?.wh_qrcode) {
            await this.sendWebhook(webhook.wh_qrcode, object, 'qrcode');
        }
    }

    static async wh_code(session, req, code) {

        const webhook = await Sessions.getClient(session);

        const object = {
            wook: 'CODE',
            result: 200,
            session,
            state: 'CODE_RECEIVED',
            status: 'awaitReadCode',
            code: code,
            number: req?.number
        };

        if (webhook?.wh_qrcode) {
            await this.sendWebhook(webhook.wh_qrcode, object, 'code');
        }
    }

    static async wh_incomingCall(session, response) {
        
        const webhook = await Sessions.getClient(session);

        const object = {
            wook: 'INCOMING_CALL',
            id: response?.id,
            phone: response?.peerJid,
            offer_time: moment.unix(response?.offerTime).format('DD-MM-YYYY HH:mm:ss'),
            isVideo: response?.isVideo,
            isGroup: response?.isGroup,
            participants: response?.participants,
            session,
            data: response
        };

        if (webhook?.wh_status) {
            await this.sendWebhook(webhook.wh_status, object, 'messages');
        }
    }
};
