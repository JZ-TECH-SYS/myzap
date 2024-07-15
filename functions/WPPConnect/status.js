
const Sessions = require('../../controllers/SessionsController')

const logger = require('../../util/logger')
module.exports = class Status {

	static async sendTextToStorie(req, res) {
		
		try {

			let { session, text, backgroundColor, fontSize } = req?.body;

			if (!text) {
	
				res?.status(400)?.json({
					status: 400,
					error: "Text não foi informado, você pode enviar um text, backgroundColor e fontSize"
				})
	
			}else {
	
				let data = await Sessions?.getClient(session)
				let response = await data?.client?.sendTextStatus(text, { backgroundColor: backgroundColor || "#ffffff", fontSize: fontSize || 2 })
	
				res?.status(200)?.json({
					result: 200, 
					type: 'status',
					session: session,
					text: text,
					data: response
				})
	
			}
		
		}catch (error) {
		
			logger.error(`Error on sendTextToStorie: ${error?.message}`)

            res.status(500).json({
                response: false,
                data: error?.message?.message
            });
		
		}
		
	}

	static async sendImageToStorie(req, res) {

		try {

			let { session, path, caption } = req?.body;
			
			if (!path) {
				return res?.status(400)?.send({
					status: 400,
					error: "Path não informado",
					message: "Informe uma URL válida"
				});
			}

			let data = await Sessions?.getClient(session)

			let response = await data?.client?.sendImageStatus(path, { caption: caption || '' })

			res?.status(200)?.json({
				result: 200, 
				type: 'status',
				session: session,
				data: response
			})

		} catch (error) {

			logger.error(`Error on sendImageToStorie: ${error?.message}`)

            res.status(500).json({
                response: false,
                data: error?.message?.message
            });

		}

	}

	static async sendVideoToStorie(req, res) {

		let { session, path, caption } = req?.body;

		if (!path) {
			res?.status(400)?.send({
				status: 400,
				error: "Path não informado",
				message: "Informe uma URL válida"
			});
		}

		try {
				
			let data = await Sessions?.getClient(session)
			let isURL = Sessions?.isURL(path);
			let name = path?.split(/[\/\\]/)?.pop();
			let base64 = isURL == true ? await Sessions?.UrlToBase64(path) : await Sessions?.fileToBase64(path);
			let response = await data?.client?.sendVideoStatus(base64, name, caption)
			
			res?.status(200)?.json({
				result: 200,
				type: 'status',
				session: session,
				file: name,
				data: response
			})
		}
		catch (error) {
			
			logger.error(`Error on sendVideoToStorie: ${error?.message}`)

            res.status(500).json({
                response: false,
                data: error?.message?.message
            });

		}
	}

	static async setProfilePic(req, res) {

		let { session, number, path } = req?.body;

		if (!path) {
			res?.status(400)?.send({
			status: 400,
			error: "Path não informado",
			message: "Informe o path. URL caso o arquivo esteja na internet ou base64"
			});
		}

		if (number?.length > 0) {

			if (number?.includes('-')) {

				number = `${number}@g.us`

			} else if (!number?.includes('-') && (number.length == 18)) {
				number = `${number}@g.us`

			} else {
				res?.status(400).json({
					status: 400,
					message: "O numero informado é invalido, informe o id do grupo ao qual deseja alterar a foto, ou deixe o campo numero vazio para alterar o seu proprio perfil."
				})

			}
			
		}

		try {
			
			let data = await Sessions?.getClient(session)
			let isURL = Sessions?.isURL(path);
			let base64 = isURL == true ? await Sessions?.UrlToBase64(path) : path;
			let response = await data?.client?.setProfilePic(base64, number)

			res?.status(200)?.json({
				result: 200,
				type: 'profile',
				session: session,
				data: response
			})
			
		}catch (error) {
			
			logger.error(`Error on setProfilePic: ${error?.message}`)

            res.status(500).json({
                response: false,
                data: error?.message?.message
            });
			
		}

	}

	static async setProfileName(req, res) {

		let { session, name } = req?.body;

		if (!name) {
			res?.status(400)?.send({
			status: 400,
			error: "Nome não informado"
			});
		}
		
		try {

			let data = await Sessions?.getClient(session)
			let response = await data?.client?.setProfileName(name)

			res?.status(200)?.json({
				result: 200,
				type: 'profile',
				session: session,
				data: response
			})

		}catch (error) {
			
			logger.error(`Error on setProfileName: ${error?.message}`)

            res.status(500).json({
                response: false,
                data: error?.message?.message
            });
		}

	}

	static async setProfileStatus(req, res) {

		try {
				
			let { session, status } = req?.body;

			if (!status) {
				res?.status(400)?.send({
					status: 400,
					error: "Status não informado"
				});
			}

			let data = await Sessions?.getClient(session)
			let response = await data?.client?.setProfileStatus(status)

			res?.status(200)?.json({
				result: 200,
				type: 'profile',
				session: session,
				data: response
			})

		} catch (error) {
		
			logger.error(`Error on setProfileStatus: ${error?.message}`)

            res.status(500).json({
                response: false,
                data: error?.message?.message
            });
			
		}

	}
	
}
