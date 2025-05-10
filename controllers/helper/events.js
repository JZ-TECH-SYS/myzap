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
    const type = this.normalizarTipo(message);
    const base64 = await this.baixarMidia(type, client, message?.id);
    const timestamp = this.formatarData(message?.timestamp);
    const nome = message?.sender?.pushname || message?.sender?.verifiedName || message?.sender?.shortName || message?.sender?.name || "";

    const base = {
      wook: message?.fromMe ? 'SEND_MESSAGE' : 'RECEIVE_MESSAGE',
      status: message?.fromMe ? 'SENT' : 'RECEIVED',
      type,
      fromMe: message?.fromMe,
      id: message?.id,
      session,
      isGroupMsg: message?.isGroupMsg,
      author: message?.author || null,
      name: nome,
      to: message?.to?.split('@')[0],
      from: message?.from?.split('@')[0],
      quotedMsg: message?.quotedMsg || '',
      quotedMsgId: message?.quotedMsgId || '',
      datetime: timestamp,
      data: message
    };

    const extras = {
      text: { content: message?.body },
      image: { caption: message?.caption || '', mimetype: message?.mimetype, base64 },
      video: { caption: message?.caption || '', content: message?.body, base64 },
      sticker: { caption: message?.caption || '', mimetype: message?.mimetype, content: message?.body, base64 },
      audio: { mimetype: message?.mimetype, base64 },
      ptt: { mimetype: message?.mimetype, base64 },
      document: { mimetype: message?.mimetype, caption: message?.caption || '', base64 },
      location: { content: message?.body, loc: message?.loc, lat: message?.lat, lng: message?.lng },
      link: { thumbnail: message?.thumbnail, title: message?.title, description: message?.description, url: message?.body },
      vcard: { contactName: message?.vcardFormattedName, contactVcard: message?.body },
      multi_vcard: { contactName: message?.vcardFormattedName, vcardList: message?.vcardList },
      list: { content: message?.list },
      list_response: { listResponse: message?.listResponse, content: message?.content },
      order: { content: '', order: await client.getOrderbyMsg(message?.id) }
    };

    return { ...base, ...(extras[type] || {}) };
  }
};
