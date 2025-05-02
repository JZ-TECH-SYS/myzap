
const express = require('express');
const Router = express.Router();

const engine = require('../engines/WppConnect');
const Sessions = require('../controllers/SessionsController.js');
const Mensagens = require('../functions/WPPConnect/mensagens');
const Auth = require('../functions/WPPConnect/auth');

const config = require('../config');

const { checkParams } = require('../middlewares/validations');
const { checkNumber } = require('../middlewares/checkNumber');
const { checkAPITokenMiddleware } = require('../middlewares/checkAPITokenMiddleware');

const DeviceModel = require('../Models/device.js');

const Device = DeviceModel(config.sequelize);

Router.post('/start', checkParams, async (req, res) => {
	
  	let session = req.body.session
  	let data = await Sessions.getClient(session)
	
  	try {

		// Exemplo de como acessar o número de solicitações de um usuário específico
		const session = req.body.session;

		let last_start = new Date(data.last_start);

		await Device.update({
			last_start: last_start,
			attempts_start: data.attempts_start + 1
		}, { where: { session: session } });

		if (data) {

			let status_permited = ['CONNECTED', 'inChat', 'isLogged', 'isConnected'];
			
			if (status_permited.includes(data?.status)) {
				
				return res.status(200).json({
					result: 'success',
					session: session,
					state: 'CONNECTED',
					status: data?.status,
				});

			}else if (data?.state === 'STARTING') {

				return res.status(200).json({
					result: 'success',
					session: session,
					state: 'STARTING',
					status: data?.status,
				});

			}else if (data.state === 'QRCODE') {

				return res.status(200).json({
					result: 'success',
					session: session,
					state: data?.state,
					status: data?.status,
					qrcode: data?.qrCode,
					urlcode: data?.urlCode,
				});

			}else if (data.status === 'INITIALIZING') {

				return res.status(200).json({
					result: 'success',
					session: session,
					state: 'STARTING',
					status: data?.status,
				});

			}else{

				engine.start(req, res);
			
				return res.status(200).json({
					result: "success",
					session: session,
					state: "STARTING",
					status: "INITIALIZING",
				});
				
			}

		} else {
			
			engine.start(req, res);

			return res.status(200).json({
				result: "success",
				session: session,
				state: "STARTING",
				status: "INITIALIZING",
			});
		}
		

	} catch (error) {

		console.log('error', error)

		res.status(500).json({
			"result": 500,
			"status": "FAIL",
			response: false,
			data: error
		});
		
	}

})

Router.post('/instances', checkAPITokenMiddleware, Sessions.instances);

// Sessões 
// #swagger.tags = ['Sessions']
Router.get('/getQrCode', Auth.getQrCode);

Router.post('/getAllSessions', Sessions.getAllSessions);
Router.post('/getConnectionStatus', checkParams, Sessions.getConnectionStatus);
Router.post('/deleteSession', Sessions.deleteSession);

// Mensagens
// #swagger.tags = ['Messages']
Router.post('/sendText', checkParams, checkNumber, Mensagens.sendText);
Router.post('/sendImage', checkParams, checkNumber, Mensagens.sendImage);
Router.post('/sendVideo', checkParams, checkNumber, Mensagens.sendVideo);
Router.post('/sendFile64', checkParams, checkNumber, Mensagens.sendFile64);
Router.post('/sendFile', checkParams, checkNumber, Mensagens.sendFile);

module.exports = Router;