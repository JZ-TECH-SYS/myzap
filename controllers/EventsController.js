const webhooks = require('./WebhooksController.js');

const moment = require('moment');
const logger = require('../util/logger.js');

moment()?.format('DD-MM-YYYY HH:mm:ss');
moment?.locale('pt-br')

const config = require('../config.js');

const DeviceModel = require('../Models/device.js');
const Device = DeviceModel(config.sequelize);
module.exports = class Events {

	static async receiveMessage(session, client, req) {

		await client?.onAnyMessage(async message => {

			let types_permited = [
				'chat',
				'image',
				'sticker',
				'audio',
				'ptt',
				'video',
				'link', 

				//uteis
				'location',
				'document',
				'vcard',
				'multi_vcard',

				// templates
				'list',
				'list_response', 
				'order',
				
				// others
				'payment',
				'gp2',
				'protocol',
				'product',
				'poll_creation',
				'template_button_reply',
				'groups_v4_invite',

				'e2e_notification', 

				// remove
				//'ciphertext' 
			]

			let from_not_permited = ['status', 'status@broadcast']

			let subtype_not_permited = ['ephemeral_keep_in_chat', 'initial_pHash_mismatch']

			if (types_permited?.includes(message?.type)) {
				
				if (from_not_permited?.includes(message?.from)) {
					//ignore status messages
					return
				}

				if (subtype_not_permited?.includes(message?.subtype)) {
					//ignore status messages
					return
				}

				let type = message?.type

				if (type == 'chat' && message?.subtype == 'url') {
					type = 'link'
				} 
				
				if (type == 'chat') {
					type = 'text'
				}

				let response = []

				switch (type) {

					case 'text':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'text',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"content": message?.body,
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"timestamp": message?.timestamp,
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"data": message,
					}

					break;

				case 'image':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'image',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"caption": message?.caption != undefined ? message?.caption : "",
						"mimetype": message?.mimetype,
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"base64": await client?.downloadMedia(message?.id),
						"data": message,
					}

					break;
				
				case 'sticker':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'sticker',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"content": message?.body,
						"caption": message?.caption != undefined ? message?.caption : "",
						"mimetype": message?.mimetype,
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"base64": await client?.downloadMedia(message?.id),
						"data": message,
					}

					break;

				case 'audio':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'audio',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"mimetype": message?.mimetype,
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"base64": await client?.downloadMedia(message?.id),
						"data": message,
					}
					break;

				case 'ptt':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'ptt',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"mimetype": message?.mimetype,
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"base64": await client?.downloadMedia(message?.id),
						"data": message,
					}
					break;

				case 'video':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'video',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"content": message?.body,
						"caption": message?.caption != undefined ? message?.caption : "",
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"base64": await client?.downloadMedia(message?.id),
						"data": message,
					}

					break;

				case 'location':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'location',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"content": message?.body,
						"loc": message?.loc,
						"lat": message?.lat,
						"lng": message?.lng,
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"timestamp": message?.timestamp,
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"data": message,
					}

					break;

				case 'document':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'document',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"mimetype": message?.mimetype,
						"caption": message?.caption != undefined ? message?.caption : "",
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"base64": await client?.downloadMedia(message?.id),
						"data": message,
					}

					break;

				case 'link':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'link',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"thumbnail": message?.thumbnail,
						"title": message?.title,
						"description": message?.description,
						"url": message?.body,
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"data": message,
					}
					break;

				case 'vcard':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'vcard',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"contactName": message?.vcardFormattedName,
						"contactVcard": message?.body,
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"data": message,
					}

					break;

				case 'multi_vcard':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'vcard',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"contactName": message?.vcardFormattedName,
						"vcardList": message?.vcardList,
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"data": message,
					}

					break;

				case 'order':

					let result = await client.getOrderbyMsg(message?.id)

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'order',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"content": '',
						"quotedMsg": message?.quotedMsg || '',
						"quotedMsgId": message?.quotedMsgId || '',
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"order": result,
						"data": message,
					}

					break;

				case 'list':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": 'list',
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"content": message.list,
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"data": message,
					}

					break;

				case 'list_response':

					response = {
						"wook": message?.fromMe == true ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
						"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
						"type": message?.type,
						"fromMe": message?.fromMe,
						"id": message?.id,
						"session": session,
						"isGroupMsg": message?.isGroupMsg,
						"author": message?.author ? message?.author : null,
						"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
						"to": message?.to?.split('@')[0],
						"from": message?.from?.split('@')[0],
						"listResponse": message?.listResponse,
						"content": message?.content,
						"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
						"data": message,
					}

					break;

					default:
						response = {
							"wook": message?.type ? message?.type.toUpperCase() : 'EVENT',
							"status": message?.fromMe == true ? 'SENT' : 'RECEIVED',
							"type": message?.type,
							"fromMe": message?.fromMe,
							"id": message?.id,
							"session": session,
							"isGroupMsg": message?.isGroupMsg,
							"author": message?.author ? message?.author : null,
							"name": message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "",
							"to": message?.to?.split('@')[0],
							"from": message?.from?.split('@')[0],
							"content": message?.body,
							"quotedMsg": message?.quotedMsg || '',
							"quotedMsgId": message?.quotedMsgId || '',
							"timestamp": message?.timestamp,
							"datetime": moment?.unix(message?.timestamp)?.format('DD-MM-YYYY HH:mm:ss'),
							"data": message,
						}
						break;

				}

				if( message?.fromMe == true ){
				
					req.funcoesSocket.messagesent(session, response)
				
				}else {

					req.funcoesSocket.message(session, response)
				}

				await webhooks?.wh_messages(session, response)

			}else{
				
				console.log('Tipo de mensagem não permitido:', message?.type)
			
			}

			req.funcoesSocket.events(session, message)

		})
	}

  static statusMessage(session, client, req) {

	client?.onAck(async ack => {

		let type = ack?.type
		if (type == 'chat' && ack?.subtype == 'url') {
			type = 'link'
		} else if (type == 'chat' && !ack?.subtype) {
			type = 'text'
		}

		let status
		
		switch (ack?.ack) {
			case 0:
				status = 'CLOCK'
				break;
			case -3:
				status = 'CONTENT_GONE'
				break;
			case -4:
				status = 'CONTENT_TOO_BIG'
				break;
			case -5:
				status = 'CONTENT_UNUPLOADABLE'
				break;
			case -2:
				status = 'EXPIRED'
				break;
			case -1:
				status = 'FAILED'
				break;
			case -6:
				status = 'INACTIVE'
				break;
			case -7:
				status = 'MD_DOWNGRADE'
				break;
			case 4:
				status = 'PLAYED'
				break;
			case 3:
				status = 'READ'
				break;
			case 2:
				status = 'RECEIVED'
				break;
			case 1:
				status = 'SENT'
				break;
			}

			let response = {
				"wook": 'MESSAGE_STATUS',
				"status": status,
				"type": type,
				"id": ack?.id?._serialized,
				"from": ack?.from?.split('@')[0],
				"to": ack?.to?.split('@')[0],
				"session": session,
				"dateTime": moment?.unix(ack?.t)?.format('DD-MM-YYYY HH:mm:ss'),
				"data": ack
			}
			
			req.funcoesSocket.ack(session, response)

			await webhooks?.wh_messages(session, response)

		});
	}

	static async statusConnection(session, client, req) {

		client?.onStateChange(async (state) => {

			console.log('State changed', state);

			await Device.update({ state: state, updated_at: moment().format('YYYY-MM-DD HH:mm:ss') }, { where: { session: session } });

			//OPENING
			if ('OPENING'?.includes(state)) {
				logger?.info(`[SESSION] ${session} - Abrindo navegador.`);
			}

			//PAIRING
			if ('PAIRING'?.includes(state)) {
				logger?.info(`[SESSION] ${session} - Lendo o QRCode.`);
			}

			// force whatsapp take over
			if ('CONFLICT'?.includes(state)){
				client?.useHere()
				logger?.info(`[SESSION] ${session} - Conflito de login.`);
			}
			
			// detect disconnect on whatsapp
			if ('UNPAIRED'?.includes(state)) {
				await Device.destroy({ where: { session: session } });
			}

			if (state === 'TIMEOUT') {
			
				client?.startPhoneWatchdog(15000); // 15s
				client?.stopPhoneWatchdog(15000); // 15s
				
			}

		});
	}
}