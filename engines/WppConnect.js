
const wppconnect = require('@wppconnect-team/wppconnect');
const Sessions = require('../controllers/SessionsController.js');
const events = require('../controllers/EventsController.js');
const webhooks = require('../controllers/WebhooksController.js');
const fnSocket = require('../controllers/FNSocketsController.js');
const chalk = require('chalk');
const { exec } = require('child_process');

const os = require('os');

const config = require('../config.js');

const DeviceModel = require('../Models/device.js');
const Device = DeviceModel(config.sequelize);

const UserModel = require('../Models/user.js');
const logger = require('../util/logger.js');
const User = UserModel(config.sequelize);

//get ENV 
const HOST = process?.env?.HOST;

console.log(chalk.green(`[SERVER] ${chalk.bold.green('HOST:')} ${chalk.bold.green(HOST)}`))

module.exports = class Wppconnect {
	
	static async start(req, res) {
		
		let session = req?.body?.session ? req?.body?.session : ''
		let sessionkey = req.headers['sessionkey']
		let number = req?.body?.number ? req?.body?.number : ''
		let body = req?.body ? req?.body : []

		let wh_connect = req?.body?.wh_connect ? req?.body?.wh_connect : ''
		let wh_status = req?.body?.wh_status ? req?.body?.wh_status : ''
		let wh_message = req?.body?.wh_message ? req?.body?.wh_message : ''
		let wh_qrcode = req?.body?.wh_qrcode ? req?.body?.wh_qrcode : ''

		console.log('Starting WhatsApp...', {
			session: session,
			sessionkey: sessionkey,
			number: number,
			wh_connect: wh_connect,
			wh_status: wh_status,
			wh_message: wh_message,
			wh_qrcode: wh_qrcode
		})

		let user = req?.session?.usuario;

		let deviceExist = await Device.findOne({ where: { session : session } });
		if (deviceExist) {
			
			await deviceExist.update({

				user_id: user?.id,

				session: session,
				sessionkey: sessionkey,
				
				qrCode: '',
				attempts: 0,
				urlCode: '',
				attempts_start: 0,
				last_start: new Date(),

				state: 'STARTING',
				status: 'notLogged',
				number: number,
				
				wh_qrcode: wh_qrcode,
				wh_connect: wh_connect,
				wh_status: wh_status,
				wh_message: wh_message,
				
				updated_at: new Date()
			}, { where: { session : session } });

			logger.info('Device updated successfully')
			
		}else{
			
			try {
				let user = await User.findOne({ where: { email: 'admin@admin.com' } });
				await Device.create({
					user_id: user?.id,

					session: session,
					sessionkey: sessionkey,

					qrCode: '',
					attempts: 0,
					urlCode: '',
					attempts_start: 0,
					last_start: new Date(),

					state: 'STARTING',
					status: 'notLogged',
					number: number,

					wh_qrcode: wh_qrcode,
					wh_connect: wh_connect,
					wh_status: wh_status,
					wh_message: wh_message,
					
					created_at: new Date(),
					updated_at: new Date()
				});

				logger.info('Device created successfully')

			} catch (error) {

				logger.error('Error to create device:', error)
				
				return res?.status(500)?.json({
					"result": 500,
					"status": "ERROR",
					"response": error
				})
			}
		}

		// socket.io
		const funcoesSocket = new fnSocket(req.io);

		funcoesSocket.events(session, {
			message: 'Iniciando WhatsApp. Aguarde...',
			state: 'STARTING',
			status: 'INITIALIZING',
			session: session,
			number: number
		})
		// webhook
		webhooks?.wh_connect(session, 'INITIALIZING', number, body, {
			message: "Iniciando WhatsApp. Aguarde..."
		})

		// injection webhook to req
		req.funcoesSocket = funcoesSocket

		this.initSession(req, res)

	}

	static async initSession(req, res) {

		let session = req?.body?.session;
		let sessionkey = req.headers['sessionkey'];

		const funcoesSocket = new fnSocket(req.io);

		let options = {
			
			headless: 'new',
			devtools: false,
			debug: true,
			logQR: HOST ? true : false,
			updatesLog: HOST ? true : false,
			useChrome: false,

			autoClose: 120000, // 120 seconds 
			disableWelcome: true,

			deviceSyncTimeout : 980000, // 16 minutes

			whatsappVersion: process?.env.WHATSAPP_VERSION,

			folderNameToken: './instances',
			puppeteerOptions: {
				userDataDir: `instances/${session}`,
			},

		}

		if(process?.env.HEADLESS){
			options.headless = false
		}
		
		if(process?.env?.PRODUCTION == 'true'){
			options.devtools = false
			options.debug = false
			options.logQR = false
			options.updatesLog = false
		}

		try {

			wppconnect?.create({
				session: session,
				catchQR: async (base64Qrimg, asciiQR, attempts, urlCode) => {

					this.exportQR(req, res, base64Qrimg, attempts, urlCode, asciiQR, session);

					try {
						await Device.update({ state: 'QRCODE', status: 'qrCode', qrCode: base64Qrimg, attempts: attempts, urlCode: urlCode, updated_at: new Date() }, { where: { sessionkey : sessionkey, session : session } });
					} catch (error) {
						logger.error('Error to update device:', error)
					}
				
					webhooks?.wh_qrcode(session, base64Qrimg, attempts, urlCode)

					console.log(chalk.green(`[SESSION] ${chalk.bold.green(session)} - ${chalk.bold.green('QRCode Iniciando, faça a leitura para autenticar...')}`))
				},
				statusFind: async (statusSession, session) => {

					if (statusSession === 'phoneNotConnected') {
						await Device.update({ state: 'DISCONNECTED', status: 'DISCONNECTED', last_disconnect: new Date(), updated_at: new Date() }, { where: { sessionkey : sessionkey, session : session } });
					}

					if (statusSession == 'qrReadSuccess') {
						await Device.update({ state: 'CONNECTED', status: 'qrReadSuccess', updated_at: new Date() }, { where: { sessionkey : sessionkey, session : session } });
					}

					if (statusSession === 'browserClose') {
						
						await Device.update({ 
							state: 'DISCONNECTED', 
							status: statusSession,
							qrCode: '',
							attempts: 0,
							urlCode: '',
							last_disconnect: new Date(), 
							updated_at: new Date() 
						}, { where: { sessionkey : sessionkey, session : session } });

						funcoesSocket.events(session, {
							message: 'If the browser is closed this parameter is returned.',
							state: 'DISCONNECTED',
							status: 'DISCONNECTED',
							session: session
						})

						webhooks?.wh_connect(session, statusSession, "", [], {
							message: 'If the browser is closed this parameter is returned.'
						})

					}

					if (statusSession == 'qrReadError') {

						await Device.destroy({ where: { sessionkey : sessionkey, session : session } });
						
						funcoesSocket.events(session, {
							message: `Failed to authenticate.`,
							status: statusSession,
							state: 'DISCONNECTED',
							session: session
						})

						webhooks?.wh_connect(session, statusSession, "", [], {
							message: 'Failed to authenticate, the QR code has expired or is invalid.'
						})

						exec(`rm -rf instances/${session}*`);

					}

					if (statusSession == 'qrReadFail') {

						await Device.destroy({ where: { sessionkey : sessionkey, session : session } });

						funcoesSocket.events(session, {
							message: `If the browser stops when the QR code scan is in progress, this parameter is returned.`,
							status: statusSession,
							state: 'DISCONNECTED',
							session: session
						})

						webhooks?.wh_connect(session, statusSession, "", [], {
							message: 'If the browser stops when the QR code scan is in progress, this parameter is returned.'
						})

						exec(`rm -rf instances/${session}*`);

					}

					if (statusSession == 'autocloseCalled') {
						
						await Device.update({ 
							state: 'DISCONNECTED', 
							status: statusSession,
							qrCode: '',
							attempts: 0,
							attempts_start: 0,
							urlCode: '',
							last_disconnect: new Date(), 
							updated_at: new Date() 
						}, { where: { sessionkey : sessionkey, session : session } });

						funcoesSocket.events(session, {
							message: 'The browser was closed using the autoClose.',
							state: 'DISCONNECTED',
							status: statusSession,
							session: session
						})
						
						webhooks?.wh_connect(session, statusSession, "", [], {
							message: 'The browser was closed using the autoClose, time limit reached (max 90 seconds).'
						})

						exec(`rm -rf instances/${session}*`);
						
					}

					if (statusSession === 'serverClose') {
						
						await Device.update({ 
							state: 'DISCONNECTED', 
							status: statusSession,
							qrCode: '',
							attempts: 0,
							urlCode: '',
							last_disconnect: new Date(), 
							updated_at: new Date() 
						}, { where: { sessionkey : sessionkey, session : session } });
						
						funcoesSocket.events(session, {
							message: 'Client has disconnected in to wss.',
							state: 'DISCONNECTED',
							status: statusSession,
							session: session
						})

						webhooks?.wh_connect(session, statusSession, "", [], {
							message: 'Client has disconnected in to wss.'
						})

					}

					if (statusSession === 'inChat') {

						await Device.update({ 
							state: 'CONNECTED', 
							status: statusSession,
							qrCode: '',
							attempts: 0,
							urlCode: '',
							last_connect: new Date(), 
							updated_at: new Date() 
						}, { where: { sessionkey : sessionkey, session : session } });

						funcoesSocket.events(session, {
							message: `Client is ready to send and receive messages.`,
							state: 'CONNECTED',
							status: statusSession,
							session: session
						})
						
						webhooks?.wh_connect(session, 'CONNECTED', "", [], {
							message: 'Client is ready to send and receive messages.'
						})

					}

					console.log(chalk.red(`[SESSION] ${chalk.bold.red(session)} - ${chalk.bold.red(`Status: ${statusSession}`)}`))

				},
				
				...options,

				browserArgs: [

					'--disable-web-security',
					'--no-sandbox',
					'--disable-web-security',
					'--aggressive-cache-discard',
					'--disable-cache',
					'--disable-application-cache',
					'--disable-offline-load-stale-cache',
					'--disk-cache-size=0',
					'--disable-background-networking',
					'--disable-default-apps',
					'--disable-extensions',
					'--disable-sync',
					'--disable-translate',
					'--hide-scrollbars',
					'--metrics-recording-only',
					'--mute-audio',
					'--no-first-run',
					'--safebrowsing-disable-auto-update',
					'--ignore-certificate-errors',
					'--ignore-ssl-errors',
					'--ignore-certificate-errors-spki-list',
					'--disable-features=LeakyPeeker' 
					
				]
			}).then(async (wppconnect) => {
				
				Sessions?.createClient(session, req, wppconnect)

				events?.statusConnection(session, wppconnect, req)
				events?.receiveMessage(session, wppconnect, req)
				events?.statusMessage(session, wppconnect, req)
		
				let wa_version = await wppconnect?.getWAVersion()
				let wa_js_version = await wppconnect?.getWAJSVersion()
				let stateSession = await wppconnect?.getConnectionState()

				let number = await wppconnect?.getWid()
				let host_device = await wppconnect?.getHostDevice()

				await Device.update({
					state: stateSession,
					qrCode: '',
					attempts: 0,
					urlCode: '',
					last_connect: new Date(),
					
					number: number,

					battery: host_device?.battery,
					blockStoreAdds: host_device?.blockStoreAdds,
					clientToken: host_device?.clientToken,
					connected: host_device?.connected,
					is24h: host_device?.is24h,
					isResponse: host_device?.isResponse,
					lc: host_device?.lc,
					lg: host_device?.lg,
					locales: host_device?.locales,
					platform: host_device?.platform,
					plugged: host_device?.plugged,
					protoVersion: host_device?.protoVersion,
					pushname: host_device?.pushname,
					ref: host_device?.ref,
					refTTL: host_device?.refTTL,
					serverToken: host_device?.serverToken,
					smbTos: host_device?.smbTos,
					tos: host_device?.tos,
					
					wa_version: wa_version,
					wa_js_version: wa_js_version,

					updated_at: new Date()
				}, { where: { sessionkey: sessionkey, session: session } });

				wppconnect?.onInterfaceChange(async (interfaceChanged) => {

					let response = {
						"wook": "INTERFACE_CHANGED",
						"result": 200,
						"session": session,
						"message": {
						  "message": `${session} is ${interfaceChanged?.displayInfo} mode ${interfaceChanged?.mode} whatsapp, info ${interfaceChanged?.info}`,
						},
						"body": {
							...interfaceChanged
						}
					}

					await webhooks?.wh_messages(session, response)

					funcoesSocket?.interface(session, {
						message: `${session} is ${interfaceChanged?.displayInfo} mode ${interfaceChanged?.mode} whatsapp, info ${interfaceChanged?.info}`,
						state: 'INTERFACE_CHANGED',
						interfaceChanged: interfaceChanged,
						session: session
					})
					
				});

				wppconnect?.onNotificationMessage(async (notification) => {

					let response = {
						"wook": 'NOTIFICATION_MESSAGE',
						"session": session,
						"notification": notification,
						"data": {
							"notification": notification
						}
					}

					await webhooks?.wh_messages(session, response)

					funcoesSocket?.events(session, {
						message: 'NOTIFICATION_MESSAGE',
						state: 'NOTIFICATION_MESSAGE',
						notification: notification,
						session: session
					})

				});

			}).catch(async (error) => {

				logger.error('Error a create session in browser:', error)
				console.log(error)
				exec(`rm -rf instances/${session}`);

				return res?.status(500)?.json({
					"result": 500,
					"status": "ERROR",
					"response": error
				})

			})

			wppconnect.defaultLogger.level = 'silly';

		} catch (error) {
			
			logger.error('Error fatal, session not created:', error)
			console.log(error)
			exec(`rm -rf instances/${session}`);

			return res?.status(500)?.json({
				"result": 500,
				"status": "ERROR",
				"response": error
			})

		}
	}

	static async exportQR(req, res, qrCode, urlCode, attempts, asciiQR, session) {

		req?.io?.emit('qrcode', {
			message: 'QRCode Iniciando, faça a leitura para autenticar...',
			state: 'QRCODE',
			qrCode: qrCode != undefined ? qrCode : '',
			attempt: attempts != undefined ? attempts : '',
			session: session != undefined ? session : '',
		})

		req?.io?.emit('events', {
			message: 'QRCode Iniciando, esse evento será descontinuado em breve, utilize o evento qrcode',
			state: 'QRCODE',
			qrCode: qrCode != undefined ? qrCode : '',
			asciiQR: asciiQR != undefined ? asciiQR : '',
			attempt: attempts != undefined ? attempts : '',
			urlCode: urlCode != undefined ? urlCode : '',
			session: session != undefined ? session : '',
		})
		
	}

	static randomInt(min, max) {
		return min + Math.floor((max - min) * Math.random());
	}
}
