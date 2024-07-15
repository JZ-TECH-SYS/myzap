
const Sessions = require('../../controllers/SessionsController');

const logger = require('../../util/logger')
module.exports = class Auth {

	static async getQrCode(req, res) {

		let session = req?.query?.session;
		let sessionkey = req?.query?.sessionkey;
		let data = await Sessions?.getClient(session)

		if (!session) {
			
			res?.status(401)?.json({
				"result": 401,
				"messages": "Não autorizado, verifique se o nome da sessão esta correto"
			})

		} else if (data?.sessionkey != sessionkey) {

			res?.status(401)?.json({
				"result": 401,
				"messages": "Não autorizado, verifique se o sessionkey esta correto"
			})
		
		} else {

			try {
				
				let img = Buffer?.from(data?.qrCode?.replace(/^data:image\/(png|jpeg|jpg);base64,/, ''), 'base64');

				res?.writeHead(200, {
					'Content-Type': 'image/png',
					'Content-Length': img?.length
				});

				res?.end(img);

			} catch (error) {
				
				logger.error(`Error on getQrCode: ${error?.message}`)

				res.status(500).json({
					response: false,
					data: error?.message?.message
				});

			}
		}
	}

}

