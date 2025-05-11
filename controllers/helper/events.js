const moment = require('moment');
moment.locale('pt-br');

module.exports = {
  tiposPermitidos: [
    'chat', 'image', 'sticker', 'audio', 'ptt', 'video', 'link',
    'location', 'document', 'vcard', 'multi_vcard',
    'list', 'list_response', 'order',
    'payment', 'gp2', 'protocol', 'product',
    'poll_creation', 'template_button_reply', 'groups_v4_invite',
    'e2e_notification'
  ],

  fromBloqueado: ['status', 'status@broadcast'],
  subtypesBloqueado: ['ephemeral_keep_in_chat', 'initial_pHash_mismatch'],

  isPermitido(message) {
    return this.tiposPermitidos.includes(message?.type)
      && !this.fromBloqueado.includes(message?.from)
      && !this.subtypesBloqueado.includes(message?.subtype);
  },

  normalizarTipo(message) {
    if (message?.type === 'chat' && message?.subtype === 'url') return 'link';
    if (message?.type === 'chat') return 'text';
    return message?.type;
  },

  formatarData(timestamp) {
    return moment.unix(timestamp).format('DD-MM-YYYY HH:mm:ss');
  },

  tipoAckToStatus(ack) {
    const mapa = {
      0: 'CLOCK', 1: 'SENT', 2: 'RECEIVED', 3: 'READ', 4: 'PLAYED',
      '-1': 'FAILED', '-2': 'EXPIRED', '-3': 'CONTENT_GONE', '-4': 'CONTENT_TOO_BIG',
      '-5': 'CONTENT_UNUPLOADABLE', '-6': 'INACTIVE', '-7': 'MD_DOWNGRADE'
    };
    return mapa[ack] || 'UNKNOWN';
  },

  async baixarMidia(type, client, id) {
    const tipos = ['image', 'video', 'audio', 'ptt', 'document', 'sticker'];
    if (tipos.includes(type)) {
      return await client?.downloadMedia(id);
    }
    return null;
  },

  async montarPayload(message, session, client) {
    const type = this.normalizarTipo(message);   // text, image, …
    const base64 = await this.baixarMidia(type, client, message.id);
    const timestamp = this.formatarData(message.timestamp);
    const nome = message?.sender?.pushname
      || message?.sender?.verifiedName
      || message?.sender?.shortName
      || message?.sender?.name
      || '';

    const base = {
      wook: message.fromMe ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
      status: message.fromMe ? 'SENT' : 'RECEIVED',
      type,
      fromMe: message.fromMe,
      id: message.id,
      session,
      isGroupMsg: message.isGroupMsg,
      author: message.author || null,
      name: nome,
      to: message.to?.split('@')[0],
      from: message.from?.split('@')[0],
      quotedMsg: message.quotedMsg || '',
      quotedMsgId: message.quotedMsgId || '',
      datetime: timestamp,
      data: message
    };

    /* ---------------- extras específicos ---------------- */
    let extras = {};

    switch (type) {
      case 'text':
        extras = { content: message.body };
        break;

      case 'image':
        extras = { caption: message.caption || '', mimetype: message.mimetype, base64 };
        break;

      case 'video':
        extras = { caption: message.caption || '', content: message.body, base64 };
        break;

      case 'sticker':
        extras = { caption: message.caption || '', mimetype: message.mimetype, content: message.body, base64 };
        break;

      case 'audio':
      case 'ptt':
        extras = { mimetype: message.mimetype, base64 };
        break;

      case 'document':
        extras = { mimetype: message.mimetype, caption: message.caption || '', base64 };
        break;

      case 'location':
        extras = { content: message.body, loc: message.loc, lat: message.lat, lng: message.lng };
        break;

      case 'link':
        extras = { thumbnail: message.thumbnail, title: message.title, description: message.description, url: message.body };
        break;

      case 'vcard':
        extras = { contactName: message.vcardFormattedName, contactVcard: message.body };
        break;

      case 'multi_vcard':
        extras = { contactName: message.vcardFormattedName, vcardList: message.vcardList };
        break;

      case 'list':
        extras = { content: message.list };
        break;

      case 'list_response':
        extras = { listResponse: message.listResponse, content: message.content };
        break;

      case 'order':
        try {
          const orderInfo = await client.getOrderbyMsg(message.id);
          extras = { content: '', order: orderInfo };
        } catch (err) {
          console.error('[PAYLOAD] erro getOrderbyMsg:', err);
        }
        break;

      default:
        // outros tipos sem extras
        break;
    }

    console.log('[DEBUG] montarPayload OK – type:', type);
    return { ...base, ...extras };
  }
};
