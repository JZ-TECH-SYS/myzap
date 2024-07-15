const Sessions = require('../../controllers/SessionsController');
const Cache = require('../../util/cache')
const moment = require('moment')
moment().format('DD-MM-YYYY HH:mm:ss');
moment.locale('pt-br')

const logger = require('../../util/logger')

module.exports = class Commands {

	static async getClientTokenBrowser(req, res) {

		try {

			let data = await Sessions.getClient(req.body.session)
			let response = await data.client.getClientTokenBrowser()

			res.status(200).json({
				"result": 200,
				"token": response
			})

		} catch (error) {

			logger.error(`Error on getClientTokenBrowser: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}

	}

	//getLastSeen
	static async getLastSeen(req, res) {

		try {

			let data = await Sessions.getClient(req.body.session)
			let response = await data.client.getLastSeen(req.body.number + '@c.us')

			res.status(200).json({
				"result": 200,
				"data": response
			})

		} catch (error) {

			logger.error(`Error on getLastSeen: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});

		}

	}

	static async getTheme(req, res) {

		try {

			let data = await Sessions.getClient(req.body.session)
			let response = await data.client.getTheme()

			res.status(200).json({
				"result": 200,
				"data": response
			})

		} catch (error) {

			logger.error(`Error on getTheme: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}

	}

	static async getWAJSVersion(req, res) {

		try {

			let data = await Sessions.getClient(req.body.session)
			let response = await data.client.getWAJSVersion()

			res.status(200).json({
				"result": 200,
				"data": response
			})

		} catch (error) {

			logger.error(`Error on getWAJSVersion: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}

	}

	static async getWAVersion(req, res) {

		try {

			let data = await Sessions.getClient(req.body.session)
			let response = await data.client.getWAVersion()

			res.status(200).json({
				"result": 200,
				"data": response
			})

		} catch (error) {

			logger.error(`Error on getWAVersion: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}

	}

	static async getHostDevice(req, res) {

		try {
			
			let data = await Sessions.getClient(req.body.session)
			let response = await data.client.getHostDevice()
			
			res.status(200).json({
				"result": 200,
				"data": response
			})

		} catch (error) {

			logger.error(`Error on getHostDevice: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
	}

	static async getWid(req, res) {
		
		try {

			let data = await Sessions.getClient(req.body.session)
			const response = await data.client.getWid()

			res.status(200).json({
				"result": 200,
				"number": response
			})

		} catch (error) {

			logger.error(`Error on getWid: ${error?.message}`)

			res.status(400).json({
				result: 400,
				number: "",
				response: false,
				data: error?.message
			});
		}
	}

	static async getContact(req, res) {
		try {
		
			const { number } = req.body;

			let data = await Sessions.getClient(req.body.session)
			const response = await data.client.getContact(number + '@c.us')

			res.status(200).json({
				"result": 200,
				"number": response
			})

		} catch (error) {

			logger.error(`Error on getContact: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
	}

	static async getAllContacts(req, res) {

		try {

			let device = await Sessions.getClient(req.body.session)
			let client = device.client
			
			let response = await client.getAllContacts()

			let contacts = response.map(function (data) {
				return {
					'name': data.name ? data.name : '',
					'realName': data.pushname ? data.pushname : '',
					'formattedName': data.formattedName ? data.formattedName : '',
					'phone': data.id.user,
					'business': data.isBusiness,
					'verifiedName': data.verifiedName ? data.verifiedName : '',
					'isMyContact': data.isMyContact,
					'data' : data
				}
			})

			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS",
				"contacts": contacts
			})

		} catch (error) {

			logger.error(`Error on getAllContacts: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
	}

	static async getAllChats(req, res) {

		try {

			const { session, options } = req.body;

			const device = await Sessions.getClient(session)
			const client = device.client

			const response = await client.listChats(options || false)

			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS",
				"contacts": response
			})
			
		} catch (error) {

			logger.error(`Error on getAllChats: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
	}

	static async getAllChatsWithMessages(req, res) {

		try {

			let data = await Sessions.getClient(req.body.session)
			let response = await data.client.getAllChatsWithMessages()

			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS",
				"contacts": response
			})

		} catch (error) {

			logger.error(`Error on getAllChatsWithMessages: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
	}

	static async getAllNewMessages(req, res) {

		try {

			let data = await Sessions.getClient(req.body.session)
			let response = await data.client.getAllNewMessages()

			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS",
				"contacts": response
			})

		} catch (error) {

			logger.error(`Error on getAllNewMessages: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}

	}

	static async getAllUnreadMessages(req, res) {

		try {

			let data = await Sessions.getClient(req.body.session)
			let response = await data.client.getAllUnreadMessages()

			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS",
				"contacts": response
			})

		} catch (error) {

			logger.error(`Error on getAllUnreadMessages: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
		
	}

	static async getBlockList(req, res) {
		
		try {
			let data = await Sessions.getClient(req.body.session)
			let response = await data.client.getBlockList()

			let blkcontacts = response.map(function (data) {
				return { 'phone': data ? data.split('@')[0] : '', }
			})

			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS",
				"contacts": blkcontacts
			})

		} catch (error) {
			
			logger.error(`Error on getBlockList: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
	}

	static async getMessagesChat(req, res) {

		let { session, number, count, direction } = req.body

		let device = await Sessions.getClient(session)
		let client = device.client

		try {

			let phone = await Cache?.get(number)
			let response = await client.getMessages(phone, { count: count || -1, direction: direction || 'before' })

			res.status(200).json({
				"result": 200,
				"data": response
			})

		} catch (error) {

			logger.error(`Error on getBlockList: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}

	}

	static async getProfilePic(req, res) {

		let data = await Sessions.getClient(req.body.session)
		let number = req?.body?.number.replace(/[^0-9]/g, '');

		try {

			let phone = await Cache?.get(number)
			let response = await data.client.getProfilePicFromServer(phone)
		
			return res.status(200).json({
				"result": 200,
				"messages": "SUCCESS",
				"pic_profile": response
			})

		} catch (error) {

			logger.error(`Error on getProfilePic: ${error?.message}`)

			return res.status(400).json({
				response: false,
				data: error?.message
			});
		}

	}

	static async getChat(req, res) {

		let data = await Sessions.getClient(req.body.session)

		try {

			let phone = await Cache?.get(req?.body?.number)
			let chat = await data.client.getChatById(phone)

			if (chat) {
				
				return res.status(200).json({
					"result": 200,
					"messages": "SUCCESS",
					"data": chat.contact,
					"chat": chat
				})
				
			}

			return res.status(400).json({
				"result": 400,
				"messages": "chat not found"
			})

		} catch (error) {

			logger.error(`Error on getChat: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});

		}
	}


	static async verifyNumber(req, res) {

		let data = await Sessions.getClient(req.body.session)

		try {

			let phone = await Cache?.get(req?.body?.number)
			let profile = await data.client.checkNumberStatus(phone)

			if (profile.numberExists) {
				res.status(200).json({
					"result": 200,
					"messages": "SUCCESS",
					"profile": profile
				})
			}

			return res.status(200).json({
				"result": 200,
				"messages": "UNKNOWN",
				"profile": profile
			})

		} catch (error) {

			logger.error(`Error on verifyNumber: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}

	}

	static async deleteChat(req, res) {

		let data = await Sessions.getClient(req.body.session)
		let number = `${req?.body?.number}@c.us`;

		try {

			await data.client.deleteChat(number);

			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS"
			})

		} catch (error) {

			logger.error(`Error on deleteChat: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});

		}
	}

	static async clearChat(req, res) {

		let data = await Sessions.getClient(req.body.session)
		let number = `${ req?.body?.number }@c.us`;

		try {

			await data.client.clearChatMessages(number);
			
			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS"
			})

		} catch (error) {

			logger.error(`Error on deleteChat: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});

		}

	}

	static async archiveChat(req, res) {

		let data = await Sessions.getClient(req.body.session)
		let number = `${ req?.body?.number }@c.us`;

		try {

			await data.client.archiveChat(number, true);

			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS"
			})

		} catch (error) {

			logger.error(`Error on archiveChat: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
	}

	static async deleteMessage(req, res) {
		
		const { session, messageId, deleteMediaInDevice = true, onlyLocal = true } = req.body;
	  
		try {

			let chatId =  req?.body?.number
			let data = await Sessions.getClient(session)

			if(!messageId && messageId.length == 0){
				return res.status(400).json({
					status: 'error',
					response: { message: 'Unknown messageId' },
				});
			}

			const result = await data?.client?.deleteMessage(chatId, messageId, onlyLocal, deleteMediaInDevice );
		 
			if (result) {
				return res.status(200).json({
					status: 'success', 
					response: { message: 'Message deleted' }
				});
			}
		  
			return res.status(400).json({
				status: 'error',
				response: { message: 'Error unknown on delete message' },
			});

		} catch (error) {
			
			logger.error(`Error on deleteMessage: ${error?.message}`)

			return res.status(401).json({
				status: 'error',
				data: error?.message
			});
		}
	  }

	static async markUnseenMessage(req, res) {
		
		let data = await Sessions.getClient(req.body.session)
		let number = req?.body?.number.replace(/[^0-9]/g, '');
			
		try {

			let phone = await Cache?.get(number)
			await data.client.markUnseenMessage(phone);

			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS"
			})

		} catch (error) {

			logger.error(`Error on markUnseenMessage: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}

	}

	static async blockContact(req, res) {
		
		let data = await Sessions.getClient(req.body.session)

		let number = req?.body?.number.replace(/[^0-9]/g, '');

		try {

			let phone = await Cache?.get(number)
			await data.client.blockContact(phone);
			
			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS"
			})

		} catch (error) {

			logger.error(`Error on blockContact: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});

		}
	}

	static async unblockContact(req, res) {

		let data = await Sessions.getClient(req.body.session)
		let number = req.body.number;

		try {

			let phone = await Cache?.get(number)
			await data.client.unblockContact(phone);
			
			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS"
			})

		} catch (error) {

			logger.error(`Error on unblockContact: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
	}

	static async pinChat(req, res) {

		let { session, number, option } = req.body;
		let data = Sessions.getClient(session)

		try {
			let phone = await Cache?.get(number)
			await data.client.pinChat(phone, option);
			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS"
			})

		} catch (error) {

			logger.error(`Error on pinChat: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
	}

	static async checkNumberStatus(req, res) {

		let data = await Sessions.getClient(req.body.session)
		let number = req?.body?.number.replace(/[^0-9]/g, '');

		try {

			let phone = await Cache?.get(number)
			const response = await data.client.checkNumberStatus(phone);

			res.status(200).json({
				"result": 200,
				"messages": "SUCCESS",
				"phone": response.id.user,
				"isBusiness": response.isBusiness
			})

		} catch (error) {

			logger.error(`Error on checkNumberStatus: ${error?.message}`)

			res.status(400).json({
				response: false,
				data: error?.message
			});
		}
	}
}
