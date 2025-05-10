const Sessions = require('../../../controllers/SessionsController');
const logger = require('../../../util/logger');

module.exports = {
    async setProfilePic(req, res) {
        const { session, number: rawNumber, path } = req.body;

        if (!path) {
            return res.status(400).json({
                status: 400,
                error: 'Path não informado',
                message: 'Informe o path. URL caso o arquivo esteja na internet ou base64',
            });
        }

        let number = rawNumber;

        if (number?.length > 0) {
            if (number.includes('-')) {
                number = `${number}@g.us`;
            } else if (!number.includes('-') && number.length === 18) {
                number = `${number}@g.us`;
            } else {
                return res.status(400).json({
                    status: 400,
                    message: 'O número informado é inválido. Informe o ID do grupo ou deixe em branco para alterar sua própria foto.',
                });
            }
        }

        try {
            const data = await Sessions.getClient(session);
            const isURL = Sessions.isURL(path);
            const base64 = isURL ? await Sessions.UrlToBase64(path) : path;

            const response = await data.client.setProfilePic(base64, number);

            res.status(200).json({
                result: 200,
                type: 'profile',
                session,
                data: response,
            });
        } catch (error) {
            logger.error(`Error on setProfilePic: ${error?.message}`);
            res.status(500).json({ response: false, data: error?.message });
        }
    },

    async setProfileName(req, res) {
        const { session, name } = req.body;

        if (!name) {
            return res.status(400).json({ status: 400, error: 'Nome não informado' });
        }

        try {
            const data = await Sessions.getClient(session);
            const response = await data.client.setProfileName(name);

            res.status(200).json({
                result: 200,
                type: 'profile',
                session,
                data: response,
            });
        } catch (error) {
            logger.error(`Error on setProfileName: ${error?.message}`);
            res.status(500).json({ response: false, data: error?.message });
        }
    },

    async setProfileStatus(req, res) {
        const { session, status } = req.body;

        if (!status) {
            return res.status(400).json({ status: 400, error: 'Status não informado' });
        }

        try {
            const data = await Sessions.getClient(session);
            const response = await data.client.setProfileStatus(status);

            res.status(200).json({
                result: 200,
                type: 'profile',
                session,
                data: response,
            });
        } catch (error) {
            logger.error(`Error on setProfileStatus: ${error?.message}`);
            res.status(500).json({ response: false, data: error?.message });
        }
    },
};
