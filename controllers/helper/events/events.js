const moment = require('moment');
moment.locale('pt-br');
const MediaDecryptor = require('./mediaDecryptor');

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

  async baixarMidia(type, client, message) {
    const tipos = ['image', 'video', 'audio', 'ptt', 'document', 'sticker'];
    if (!tipos.includes(type) || !message) return null;

    try {
      // 1) whatsapp-web.js: método no objeto da mensagem
      if (typeof message.downloadMedia === 'function') {
        const media = await message.downloadMedia();
        const base64 = media?.data || (typeof media === 'string' ? media : null);
        if (base64) return base64;
      } else if (client && typeof client.getMessageById === 'function') {
        // Fallback para caso mensagem tenha sido serializada e perdeu métodos
        try {
          const id = message?.id?._serialized || message?.id;
            if (id) {
              const fullMsg = await client.getMessageById(id);
              if (fullMsg && typeof fullMsg.downloadMedia === 'function') {
                const media = await fullMsg.downloadMedia();
                const base64 = media?.data || (typeof media === 'string' ? media : null);
                if (base64) return base64;
              }
            }
        } catch (e) {
          console.log('[baixarMidia] Fallback getMessageById falhou:', e.message || e);
        }
      }

      // 2) Engines que expõem decryptFile direto
      if (client && typeof client.decryptFile === 'function') {
        const buffer = await client.decryptFile(message);
        if (buffer) return Buffer.isBuffer(buffer) ? buffer.toString('base64') : null;
      }

      // 3) Adapter genérico
      if (MediaDecryptor && typeof MediaDecryptor.decryptFile === 'function') {
        const buffer = await MediaDecryptor.decryptFile({ client, message });
        if (buffer) return buffer.toString('base64');
      }

      return null;
    } catch (error) {
      console.log(`⚠️ Erro ao baixar mídia: ${error.message}`);
      return null;
    }
  },

  async montarPayload(message, session, client) {
    const type = this.normalizarTipo(message);   // text, image, …
  const base64 = await this.baixarMidia(type, client, message);
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
