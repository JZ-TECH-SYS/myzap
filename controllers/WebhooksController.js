const Sessions = require('./SessionsController.js');
const helper = require('./helper/webhooks.js');

module.exports = class Webhooks {
    static async sendWebhook(url, data, queue) {
        await helper.send(url, data, queue);
    }

    static async wh_messages(session, response) {
        const conn = await Sessions.getClient(session);
        if (conn?.wh_message) {
            await helper.send(conn.wh_message, response, 'messages');
        }
    }

    static async wh_connect(session, state, number = '', body = [], message = null) {
        const conn = await Sessions.getClient(session);
        if (conn?.wh_connect) {
            const payload = helper.buildConnectPayload(session, state, conn, number, body, message);
            await helper.send(conn.wh_connect, payload, 'connection');
        }
    }

    static async wh_status(session, state) {
        const conn = await Sessions.getClient(session);
        if (conn?.wh_status) {
            const payload = helper.buildStatusPayload(session, state);
            await helper.send(conn.wh_status, payload, 'status');
        }
    }

    static async wh_qrcode(session, qrcode, attempts, urlCode) {
        const conn = await Sessions.getClient(session);
        if (conn?.wh_qrcode) {
            const payload = helper.buildQrCodePayload(session, qrcode, attempts, urlCode);
            await helper.send(conn.wh_qrcode, payload, 'qrcode');
        }
    }

    static async wh_code(session, req, code) {
        const conn = await Sessions.getClient(session);
        if (conn?.wh_qrcode) {
            const payload = helper.buildCodePayload(session, req?.number, code);
            await helper.send(conn.wh_qrcode, payload, 'code');
        }
    }

    static async wh_incomingCall(session, callData) {
        const conn = await Sessions.getClient(session);
        if (conn?.wh_status) {
            const payload = helper.buildIncomingCallPayload(session, callData);
            await helper.send(conn.wh_status, payload, 'messages');
        }
    }
};
