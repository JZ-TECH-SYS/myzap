
const urlExists = require("url-exists");

const fs = require('fs');
const mimeTypes = require('mime-types');
const fileType = require('file-type');
const axios = require('axios');
const chalk = require('chalk');

const config = require('../config.js');

const DeviceModel = require('../Models/device.js');
const logger = require("../util/logger.js");
const Device = DeviceModel(config.sequelize);

class Sessions {

    static clients = {};

	static async instances(req, res) {

		try {

			const sessions = await Device.findAll();

			return res?.status(200)?.json({
				data: sessions,
				recordsTotal: sessions.length,
				recordsFiltered: sessions.length
			});

		} catch (error) {
			return res.status(400).send(error.message);
		}
	}

	static async createClient(session, req, wppconnect = {}) {
		
		try {

			let sessionkey = req?.headers['sessionkey'];
			const device = await Device.findOne({ where: { session: session, sessionkey: sessionkey } });
	
			// Check if the session is already injected
			if (device && wppconnect?.session != session) {
				console.log(chalk.red(`[❌ CLIENT INJECTED, SESSION INVALID] ${chalk.bold.red(session)} / ${sessionkey} - ${chalk.bold.red(`Erro ao injetar cliente!`)}`));
				return false;
			}

			// Inject client
			if (device && wppconnect && wppconnect?.session == session) {
                
				this.clients[session] = wppconnect;
				logger.info(`[💀 CLIENT INJECTED] ${session} / ${sessionkey}`)
				return true;

			}
			
			// If the session is not found in the database
			logger.error(`[❌ CLIENT INJECTED] ${session} / ${sessionkey} - Erro ao injetar cliente!`);
			return false;

		} catch (error) {

			logger.error(`[❌ CLIENT INJECTED] ${session} - Erro ao injetar cliente!`);
			return false;

		}

	}

	static async getClient(session) {

		try {

			let instance = await Device.findOne({ where: { session: session } });

			if(instance) {

				let response = {
					...instance.dataValues,
					client: this.clients[session],
				} 

				return response;
			}

			return false;

		} catch (error) {
			logger.error(`[❌ ERROR GET CLIENT] ${session} - Erro ao buscar cliente!`);
			return false;
		}

	}

	static async getAllSessions(req, res) {

		try {
			// Buscar todas as sessões no banco de dados
			const sessions = await Device.findAll();
			
			// Verificar se foram encontradas sessões
			if (sessions.length === 0) {
				
				return res.status(404).send({
					result: 404,
					status: 'NOT FOUND',
					reason: 'Nenhuma sessão encontrada!',
					data: sessions
				});

			} else {
				return res.send({
					result: 200,
					status: 'SUCCESS',
					reason: 'Sessões encontradas com sucesso!',
					data: sessions
				});
			}
		} catch (error) {
			return res.status(400).send(error.message);
		}
	}

	static async getConnectionStatus(req, res) {

		let device = await Device.findOne({ where: { session: req.body.session, sessionkey: req.headers['sessionkey'] } });

		try {

			if(device && device?.status == 'inChat'){

				res?.status(200)?.json({
					"result": 200,
					"status": device?.status,
					"data": device
				})

			}

			res.status(400).json({
				"result": 400,
				"status": device?.status,
				"data": device
			});

		} catch (error) {
			
			logger.error(`[ERROR GET CONNECTION STATUS] ${req.body.session} - Erro ao buscar status da conexão!`);

			res.status(500).json({
				"result": 500,
				"status": "FAIL",
				"data": error
			});
		}

	}

	// deletar sessão
	static async deleteSession(req, res) {

		try {

            let session = req?.body?.session;
			let logout = false;
			let close = false;

            let data = await Sessions?.getClient(session)

			//if !session
			if (!data) {
				return res?.status(404)?.json({
					result: 'error',
					message: 'Sessão não encontrada!'
				});
			}

			try {

				await data?.client?.logout();
				logout = true;
				
			} catch (error) {
				console?.log(chalk.red(`[SESSION] ${chalk.bold.red(session)} - ${chalk.bold.red(`Erro ao fechar sessão!`)}`))
			}
			
			try {

				await data?.client?.page.close();
				close = true;
				
			} catch (error) {
				console?.log(chalk.red(`[SESSION] ${chalk.bold.red(session)} - ${chalk.bold.red(`Erro ao fechar página!`)}`))				
			}

			await Device.destroy({ where: { session: session } });
			
			res?.status(200)?.json({
				logout: logout,
				close: close,
				status: true,
				message: "Sessão Fechada com sucesso"
			});

		} catch (error) {

			return res?.status(500)?.json({
				logout: false,
				close: false,
				status: false,
				error: true, 
				message: "Erro ao deletar sessão!",
				data: error
			});
			
		}
	
	}
}

module.exports = Sessions;