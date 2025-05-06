
const Sessions = require('../../controllers/SessionsController');
const config = require('../../config');
const Cache = require('../../util/cache')

// const amqp = require('amqplib');
const logger = require('../../util/logger')

// Configurações de conexão com o RabbitMQ
const rabbitMQConfig = {
	hostname: 'localhost', // ou o endereço do seu servidor RabbitMQ
	port: 5672,             // porta padrão do RabbitMQ
	username: 'guest',
	password: 'guest',
};
module.exports = class Mensagens {

	//startRecording
	static async startRecording(req, res) {

		try {

			let { session, number, time } = req.body;

			let data = await Sessions?.getClient(session)
			let phone = await Cache?.get(number)

			const response = await data?.client?.startRecording(phone, time);

			res?.status(200)?.json({
				result: 200,
				data: response,
			});

		} catch (error) {

			logger.error(`Error on startRecording: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}

	}

	//stopRecoring
	static async stopRecording(req, res) {

		try {

			let { session, number, time } = req.body;

			let data = await Sessions?.getClient(session)
			let phone = await Cache?.get(number)

			const response = await data?.client?.stopRecoring(phone, time);

			res?.status(200)?.json({
				result: 200,
				data: response,
			});

		} catch (error) {

			logger.error(`Error on stopRecording: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}

	}

	//startTyping
	static async startTyping(req, res) {

		try {

			let { session, number, time } = req.body;

			let data = await Sessions?.getClient(session)
			let phone = await Cache?.get(number)

			const response = await data?.client?.startTyping(phone, time);

			res?.status(200)?.json({
				result: 200,
				data: response,
			});

		} catch (error) {

			logger.error(`Error on startTyping: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}

	}

	static async stopTyping(req, res) {

		try {

			let { session, number } = req.body;

			let data = await Sessions?.getClient(session)
			let phone = await Cache?.get(number)

			const response = await data?.client?.stopTyping(phone);

			res?.status(200)?.json({
				result: 200,
				data: response,
			});

		} catch (error) {

			logger.error(`Error on stopTyping: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}
	}

	//createNewsletter
	static async createNewsletter(req, res) {

		try {

			let { session, name, options } = req.body;

			let data = await Sessions?.getClient(session)
			let client = data.client;

			const response = await client?.createNewsletter(name, options);

			res?.status(200)?.json({
				result: 200,
				data: response,
			});

		} catch (error) {

			logger.error(`Error on createNewsletter: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}

	}

	static async editMessage(req, res) {

		try {

			let { session, messageid, newText } = req.body;

			let data = await Sessions?.getClient(session)
			let client = data.client;

			const response = await client?.editMessage(messageid, newText);

			res?.status(200)?.json({
				result: 200,
				data: response,
			});

		} catch (error) {

			logger.error(`Error on editMessage: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}

	}

	static async sendListMessage(req, res) {

		try {

			let { session, number, description = '', sections, buttonText = 'SELECIONE UMA OPÇÃO' } = req.body;

			let device = await Sessions?.getClient(session)
			let client = device.client;

			let phone = await Cache?.get(number)

			let response = await client?.sendListMessage(phone, {
				buttonText: buttonText,
				description: description,
				sections: sections
			});

			res?.status(200)?.json({
				result: 200,
				data: response,
			});

		} catch (error) {

			logger.error(`Error on sendListMessage: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}
	}

	static async sendOrderMessage(req, res) {

		try {

			let { session, number, items } = req?.body;

			let device = await Sessions?.getClient(session)
			let client = device.client;

			const options = req.body.options || {};

			let phone = await Cache?.get(number)

			const response = await client?.sendOrderMessage(phone, items, options);
			res?.status(200)?.json({
				result: 200,
				data: response,
			});


		} catch (error) {

			logger.error(`Error on sendOrderMessage: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}
	}

	static async sendText(req, res) {

		let { session, number, text, time_typing, options } = req?.body;

		let device = await Sessions?.getClient(session);
		let client = device.client;

		let phone = await Cache?.get(number)

		let config = {
			"createChat": true,
			"delay": time_typing ? time_typing : 0
		}

		if (options) {
			config = options
		}

		try {

			const response = await client.sendText(phone, text, config);

			res?.status(200)?.json({
				result: 200,
				data: response,
			});

		} catch (error) {

			logger.error(`Error on sendText: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}

	}

	static async getPlatformFromMessage(req, res) {

		try {

			const { messageId, session } = req?.body;

			let device = await Sessions?.getClient(session)
			let client = device.client;

			const response = await client.getPlatformFromMessage(messageId);

			res.status(200).json({
				status: 'success',
				data: response,
			});

		} catch (error) {

			logger.error(`Error on getPlatformFromMessage: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}

	}

	static async sendPollMessage(req, res) {

		try {

			let { number, name, choices, options, selectableCount, session } = req?.body;

			let data = await Sessions?.getClient(session)
			let client = data.client;

			let phone = await Cache?.get(number)

			const response = await client?.sendPollMessage(phone, name, choices, options, {
				selectableCount: selectableCount || 1
			});

			res?.status(200)?.json({
				result: 200,
				data: response,
			});

		} catch (error) {

			logger.error(`Error on sendPollMessage: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}

	}

	static async downloadMediaByMessage(req, res) {

		let { session, messageId } = req?.body;

		let device = await Sessions?.getClient(session)
		let client = device.client;

		let message;

		try {

			message = await client.getMessageById(messageId);

			if (!message) {
				res.status(400).json({
					status: 'error',
					message: 'Message not found',
				});
			}

			if (!(message['mimetype'] || message.isMedia || message.isMMS)) {
				res.status(400).json({
					status: 'error',
					message: 'Message does not contain media',
				});
			}

			const buffer = await client.decryptFile(message);

			res?.status(200)?.json({
				result: 200,
				base64: buffer?.toString('base64'),
				mimetype: message?.mimetype,
				session: session,
				file: message?.filename,
				data: message,
			});

		} catch (error) {

			logger.error(`Error on downloadMediaByMessage: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}
	}

	static async sendImage(req, res) {

		try {

			const { session, path, number, caption, isViewOnce } = req?.body;

			let device = await Sessions?.getClient(session)
			let client = device.client;

			if (!path) {
				res?.status(400)?.send({
					status: 400,
					error: "Path não informado",
					message: "Informe o link do arquivo, ele deve estar na internet"
				});
			}

			let phone = await Cache?.get(number)

			await Sessions?.sleep(config.time_typing);

			let response = await client?.sendImage(phone, path, 'imagem', caption, '', isViewOnce)

			res?.status(200)?.json({
				result: 200,
				type: 'image',
				messageId: response?._serialized,
				session: session,
				from: response?.me?.wid?._serialized?.split('@')[0],
				to: response?.to?.remote?.user,
				mimetype: response?.mimeType,
				data: response,
			})

		} catch (error) {

			logger.error(`Error on sendImage: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}
	}

	static async sendVideo(req, res) {

		try {

			let { session, path, number, caption } = req?.body

			if (!path) {
				res?.status(400)?.send({
					status: 400,
					error: "Path não informado",
					message: "Informe o link do arquivo, ele deve estar na internet"
				});
			}

			let device = await Sessions?.getClient(session)
			let client = device.client;

			let phone = await Cache?.get(number)

			let isURL = Sessions?.isURL(path);
			let name = path?.split(/[\/\\]/)?.pop();
			let base64 = isURL == true ? await Sessions?.UrlToBase64(path) : await Sessions?.fileToBase64(path);
			let response = await client?.sendFileFromBase64(phone, base64, name, caption)

			res?.status(200)?.json({
				result: 200,
				type: 'video',
				session: session,
				file: name,
				data: response,
			})

		} catch (error) {

			logger.error(`Error on sendVideo: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}

	}

	static async sendSticker(req, res) {

		try {

			let { session, number } = req?.body
			let path = req?.body?.path || req?.files?.path

			if (!path) {
				res?.status(400)?.send({
					status: 400,
					error: "Path não informado",
					message: "Informe o link do arquivo, ele deve estar na internet"
				});
			}

			let device = await Sessions?.getClient(session)
			let client = device.client;

			let phone = await Cache?.get(number)

			await Sessions?.sleep(config.time_typing || 0);

			let isURL = Sessions?.isURL(path);
			let name = path?.split(/[\/\\]/)?.pop();
			let base64 = isURL == true ? await Sessions?.UrlToBase64(path) : await Sessions?.fileToBase64(path);

			let response = await client?.page?.evaluate(async ({ phone, base64 }) => await WPP.chat.sendFileMessage(phone, base64, { type: 'sticker' }), { phone, base64 });

			res?.status(200)?.json({
				result: 200,
				type: 'sticker',
				messageId: response?.id,
				session: session,
				file: name,
				data: response
			})

		} catch (error) {

			logger.error(`Error on sendSticker: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}
	}

	static async sendFile(req, res) {

		try {

			let { session, path, number } = req?.body;

			if (!path) {
				res?.status(400)?.send({
					status: 400,
					error: "Path não informado",
					message: "Informe o link do arquivo, ele deve estar na internet"
				});
			}

			let device = await Sessions?.getClient(session)
			let client = device.client;

			let phone = await Cache?.get(number)

			let options = req?.body?.options || {
				"createChat": true,
				"filename": "file",
			};

			let response = await client?.sendFile(phone, path, options)

			res?.status(200)?.json({
				result: 200,
				type: 'file',
				session: session,
				data: response
			})

		} catch (error) {

			logger.error(`Error on sendFile: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}
	}

	static async sendMultipleFiles(req, res) {
		try {
			const { session, number, files } = req.body;

			if (!files || !Array.isArray(files) || files.length === 0) {
				return res.status(400).json({
					status: 400,
					error: "Lista de arquivos (files[]) é obrigatória"
				});
			}

			const device = await Sessions?.getClient(session);
			const client = device?.client;
			const phone = await Cache?.get(number);

			let resultados = [];

			for (const file of files) {
				const { path, filename = 'file' } = file;

				if (!path) continue;

				const response = await client?.sendFile(phone, path, {
					createChat: true,
					filename
				});

				resultados.push({
					path,
					filename,
					messageId: response?.id || null,
					success: !!response
				});

				// opcional: delay entre envios
				await new Promise(r => setTimeout(r, 1000));
			}

			return res.status(200).json({
				result: 200,
				session,
				number,
				total: resultados.length,
				files: resultados
			});

		} catch (error) {
			logger.error(`Error on sendMultipleFiles: ${error?.message}`);

			return res.status(500).json({
				response: false,
				error: error?.message
			});
		}
	}


	static async sendFileLocal(req, res) {

		let { session, number, caption } = req?.body;

		try {

			if (!req?.files) {
				res?.status(400)?.send({
					status: 400,
					error: "Path não informado",
					message: "Informe o link do arquivo, ele deve estar na internet"
				});
			}

			let data = await Sessions?.getClient(session)
			let phone = await Cache?.get(number)

			let file = req?.files?.file;

			let base64 = `data:${file?.mimetype};base64,${Buffer?.from(file?.data)?.toString('base64')}`;
			let response = await data?.client?.sendFileFromBase64(phone, base64, file?.name, caption)

			res?.status(200)?.json({
				result: 200,
				type: 'file',
				session: session,
				file: file?.name,
				data: response
			})

		} catch (error) {

			logger.error(`Error on sendFileLocal: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}

	}

	static async sendFile64(req, res) {

		let { session, number, path, caption } = req?.body;

		if (!path) {
			res?.status(400)?.send({
				status: 400,
				error: "Path não informado",
				message: "Informe o path em formato Base64"
			});
		}

		let data = await Sessions?.getClient(session)

		try {

			let phone = await Cache?.get(number)

			let response = await data?.client?.sendFileFromBase64(phone, path, caption, caption)

			res?.status(200)?.json({
				result: 200,
				type: 'file',
				session: session,
				data: response
			})

		} catch (error) {

			logger.error(`Error on sendFile64: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}
	}

	static async sendMultipleFile64(req, res) {
		try {
			const { session, number, files } = req?.body;

			if (!files || !Array.isArray(files) || files.length === 0) {
				return res.status(400).json({
					status: 400,
					error: "Lista de arquivos (files[]) em Base64 é obrigatória"
				});
			}

			const device = await Sessions?.getClient(session);
			const client = device?.client;
			const phone = await Cache?.get(number);

			let resultados = [];

			for (const file of files) {
				const { base64, filename = 'arquivo', caption = '' } = file;

				if (!base64) continue;

				const response = await client?.sendFileFromBase64(phone, base64, filename, caption);

				resultados.push({
					filename,
					caption,
					success: !!response,
					messageId: response?.id || null
				});

				// Delay entre envios (opcional)
				await new Promise(r => setTimeout(r, 1000));
			}

			return res.status(200).json({
				result: 200,
				session,
				number,
				total: resultados.length,
				files: resultados
			});

		} catch (error) {
			logger.error(`Error on sendMultipleFile64: ${error?.message}`);

			return res.status(500).json({
				response: false,
				error: error?.message
			});
		}
	}


	static async sendAudio(req, res) {

		try {

			let { session, number, time_recording } = req?.body;

			let path = req?.body?.path || req?.files?.path

			let device = await Sessions?.getClient(session)
			let client = device.client;

			if (!path) {
				res?.status(400)?.send({
					status: 400,
					error: "Path não informado",
					message: "Informe o link do arquivo, ele deve estar na internet"
				});
			}

			let phone = await Cache?.get(number)

			await client.startRecording(phone, time_recording || config.time_typing);

			let isURL = Sessions?.isURL(path);

			let base64 = isURL == true ? await Sessions?.UrlToBase64(path) : await Sessions?.fileToBase64(path, {
				createChat: true
			});

			let file = path?.split(/[\/\\]/)?.pop();
			let name = file?.split('.')[0];
			let ext = file?.split('.')?.pop();

			if (ext === 'mp3' || ext === 'ogg' || ext === 'webm') {

				let response = await client?.sendPttFromBase64(phone, base64)

				res?.status(200)?.json({
					response: response,
					result: 200,
					type: 'ptt',
					session: session,
					file: name,
					data: response
				})

			} else {

				res?.status(400)?.json({
					result: 400,
					"status": "FAIL",
					"log": 'Envio de áudio permitido apenas com arquivos .mp3 ou .ogg ou .webm'
				})
			}

		} catch (error) {

			logger.error(`Error on sendAudio: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}
	}

	static async sendVoiceBase64(req, res) {

		let { session, number, path, time_recording } = req?.body;

		let device = await Sessions?.getClient(session)
		let client = device.client;

		if (!path) {

			res?.status(400)?.send({
				status: 400,
				error: "Path não informado",
				message: "Informe o path em formato Base64"
			});

		} else {

			try {

				let phone = await Cache?.get(number)

				await client.startRecording(phone, time_recording || config.time_typing);
				let response = await client?.sendPttFromBase64(phone, path);

				res?.status(200)?.json({
					result: 200,
					type: 'audio',
					messageId: response?.id,
					session: session,
					data: response
				})

			} catch (error) {

				logger.error(`Error on sendVoiceBase64: ${error?.message}`)

				res.status(500).json({
					response: false,
					data: error?.message?.message
				});

			}

		}
	}

	static async sendLink(req, res) {

		let { session, number, url, text } = req?.body;

		let data = await Sessions?.getClient(session)
		let isURL = Sessions?.isURL(url);

		if (!url) {
			res?.status(400)?.json({
				status: 400,
				error: "URL não foi informada, é obrigatorio"
			})
		} else
			if (!isURL) {
				res?.status(400)?.json({
					status: 400,
					error: "Link informado é invalido"
				})
			} else {

				try {

					let phone = await Cache?.get(number)
					await Sessions?.sleep(config.time_typing);
					let response = await data?.client?.sendLinkPreview(phone, url, text)

					res?.status(200)?.json({
						result: 200,
						type: 'link',
						messageId: response?.id,
						session: session,
						data: response
					})

				} catch (error) {

					logger.error(`Error on sendLink: ${error?.message}`)

					res.status(500).json({
						response: false,
						data: error?.message?.message
					});

				}
			}
	}

	static async sendContact(req, res) {

		let { session, number, contact, name } = req?.body
		let data = await Sessions?.getClient(session)

		if (!contact) {

			res?.status(400)?.json({
				status: 400,
				error: "Contact não foi informado"
			})

		} else if (!name) {

			res?.status(400)?.json({
				status: 400,
				error: "Nome do Contato não foi informado"
			})

		} else {

			try {

				let phone = await Cache?.get(number)

				let response = await data?.client?.sendContactVcard(phone, contact + '@c.us', name)

				res?.status(200)?.json({
					result: 200,
					type: 'contact',
					messageId: response?.id,
					session: session,
					data: response
				})
			} catch (error) {

				logger.error(`Error on sendContact: ${error?.message}`)

				res.status(500).json({
					response: false,
					data: error?.message?.message
				});

			}
		}
	}

	static async sendLocation(req, res) {

		let { session, number, lat, log, title, description, buttons } = req?.body

		if (!lat) {
			res?.status(400)?.json({
				status: 400,
				error: "Latitude não foi informada"
			})
		} else if (!log) {
			res?.status(400)?.json({
				status: 400,
				error: "Longitude não foi informada"
			})
		}
		if (!title) {
			res?.status(400)?.json({
				status: 400,
				error: "Title do endereço não foi informado"
			})
		} else if (!description) {
			res?.status(400)?.json({
				status: 400,
				error: "Descrição do endereço não foi informado"
			})
		} else {

			try {

				let data = await Sessions?.getClient(session)
				let phone = await Cache?.get(number)
				await Sessions?.sleep(config.time_typing);
				let response = await data?.client?.page?.evaluate(

					async ({ phone, lat, log, title, description, buttons }) =>
						await WPP.chat.sendLocationMessage(phone, {
							lat: lat,
							lng: log,
							name: title,
							address: `${title}\n${description}`,
							buttons: buttons,
						}),
					{ phone, lat, log, title, description, buttons }
				);

				res?.status(200)?.json({
					result: 200,
					type: 'locate',
					messageId: response?.id,
					session: session,
					data: response
				})

			} catch (error) {

				logger.error(`Error on sendLocation: ${error?.message}`)

				res.status(500).json({
					response: false,
					data: error?.message?.message
				});

			}
		}
	}

	static async reply(req, res) {

		let { session, number, messageid, text } = req?.body;
		let data = await Sessions?.getClient(session)

		if (!text) {

			res?.status(400)?.json({
				status: 400,
				error: "Text não foi informado"
			})

		} else if (!messageid) {

			res?.status(400)?.json({
				status: 400,
				error: "MessageID não foi informada, é obrigatorio"
			})

		} else {

			try {

				let phone = await Cache?.get(number)
				await Sessions?.sleep(config.time_typing);

				let response = await data?.client?.reply(phone, text, messageid);

				res?.status(200)?.json({
					result: 200,
					type: 'text',
					session: session,
					messageId: response?.id,
					data: response
				})

			} catch (error) {

				logger.error(`Error on reply: ${error?.message}`)

				res.status(500).json({
					response: false,
					data: error?.message?.message
				});

			}
		}
	}

	static async forwardMessages(req, res) {

		let { session, number, messageid } = req?.body;
		let data = await Sessions?.getClient(session)

		if (!messageid) {

			res?.status(400)?.json({
				status: 400,
				error: "MessageID não foi informado, é obrigatorio"
			})

		} else {

			try {

				let options = req?.body?.options || {};
				let phone = await Cache?.get(number)

				await Sessions?.sleep(config.time_typing);

				let response = await data?.client?.forwardMessage(phone, messageid, options);

				res?.status(200)?.json({
					result: 200,
					type: 'forward',
					session: session,
					data: response
				})

			} catch (error) {

				logger.error(`Error on forwardMessages: ${error?.message}`)

				res.status(500).json({
					response: false,
					data: error?.message?.message
				});

			}
		}
	}

	static async sendReactionToMessage(req, res) {

		try {

			let data = await Sessions?.getClient(session)

			if ((messageId || emoji) == "") {

				res?.status(400)?.json({
					error: 400,
					result: 'MessageId e emoji sao obrigatorios'
				})
			}

			let results = await data?.client?.page?.evaluate(
				async ({ messageId, emoji }) => await WPP.chat.sendReactionToMessage(messageId, emoji), { messageId, emoji }
			);

			res?.status(200)?.json({
				result: 'success',
				message: 'Reaction submitted successfully',
				data: results
			})

		} catch (error) {

			logger.error(`Error on sendReactionToMessage: ${error?.message}`)

			res.status(500).json({
				response: false,
				data: error?.message?.message
			});

		}
	}
}