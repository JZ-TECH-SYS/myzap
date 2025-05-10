const Sessions = require('../../../controllers/SessionsController');
const logger = require('../../../util/logger');

module.exports = {
    async sendTextToStorie(req, res) {
        try {
            const { session, text, backgroundColor, fontSize } = req.body;

            if (!text) {
                return res.status(400).json({
                    status: 400,
                    error: 'Text não foi informado, você pode enviar um text, backgroundColor e fontSize',
                });
            }

            const data = await Sessions.getClient(session);
            const response = await data.client.sendTextStatus(text, {
                backgroundColor: backgroundColor || '#ffffff',
                fontSize: fontSize || 2,
            });

            res.status(200).json({
                result: 200,
                type: 'status',
                session,
                text,
                data: response,
            });
        } catch (error) {
            logger.error(`Error on sendTextToStorie: ${error?.message}`);
            res.status(500).json({ response: false, data: error?.message });
        }
    },

    async sendImageToStorie(req, res) {
        try {
            const { session, path, caption } = req.body;

            if (!path) {
                return res.status(400).json({
                    status: 400,
                    error: 'Path não informado',
                    message: 'Informe uma URL válida',
                });
            }

            const data = await Sessions.getClient(session);
            const response = await data.client.sendImageStatus(path, { caption: caption || '' });

            res.status(200).json({
                result: 200,
                type: 'status',
                session,
                data: response,
            });
        } catch (error) {
            logger.error(`Error on sendImageToStorie: ${error?.message}`);
            res.status(500).json({ response: false, data: error?.message });
        }
    },

    async sendVideoToStorie(req, res) {
        try {
            const { session, path, caption } = req.body;

            if (!path) {
                return res.status(400).json({
                    status: 400,
                    error: 'Path não informado',
                    message: 'Informe uma URL válida',
                });
            }

            const data = await Sessions.getClient(session);
            const isURL = Sessions.isURL(path);
            const name = path.split(/[\/\\]/).pop();
            const base64 = isURL ? await Sessions.UrlToBase64(path) : await Sessions.fileToBase64(path);

            const response = await data.client.sendVideoStatus(base64, name, caption);

            res.status(200).json({
                result: 200,
                type: 'status',
                session,
                file: name,
                data: response,
            });
        } catch (error) {
            logger.error(`Error on sendVideoToStorie: ${error?.message}`);
            res.status(500).json({ response: false, data: error?.message });
        }
    },
};
