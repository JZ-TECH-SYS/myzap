const customLogger = require('../../../util/customLogger');

/**
 * Adapter para descriptografia de arquivos de mídia
 * Compatível com: WPPConnect, Venom, whatsapp-web.js
 */

async function detectEngine(client) {
  if (!client || typeof client !== 'object') return 'desconhecido';
  // Heurísticas simples baseadas em métodos disponíveis
  if (client?.constructor?.name === 'Client' && client?.getChatById) return 'webjs';
  if (client?.sendText && client?.getWAVersion) return 'wppconnect';
  if (client?.sendText && client?.getSessionTokenBrowser) return 'venom';
  return 'generico';
}

async function decryptFile({ client, message }) {
  if (!client || !message) {
    throw new Error('Cliente ou mensagem não fornecidos');
  }

  const engine = await detectEngine(client);
  
  try {
    switch (engine) {
      case 'webjs':
        // WhatsApp Web.js - a mídia é baixada a partir do próprio objeto da mensagem
        if (message) {
          let msgObj = message;
          // Fallback: se perdeu métodos (objeto plain), tentar reobter via client.getMessageById
          const hasDownload = typeof msgObj.downloadMedia === 'function';
          if (!hasDownload && client && typeof client.getMessageById === 'function') {
            try {
              const id = msgObj?.id?._serialized || msgObj?.id || msgObj?.id?._id;
              if (id) {
                const fetched = await client.getMessageById(id);
                if (fetched) msgObj = fetched;
              }
            } catch (e) {
              customLogger.debug('[MediaDecryptor] Fallback getMessageById falhou: ' + (e.message || e));
            }
          }
          if (typeof msgObj.downloadMedia === 'function') {
            const media = await msgObj.downloadMedia();
            if (!media) throw new Error('downloadMedia retornou vazio');
            if (media.data) return Buffer.from(media.data, 'base64');
            if (typeof media === 'string') return Buffer.from(media, 'base64');
            throw new Error('Objeto de mídia sem campo data');
          }
        }
        throw new Error('message.downloadMedia/getMessageById indisponível no WhatsApp Web.js');
        
      case 'wppconnect':
      case 'venom':
        // Ambos expõem decryptFile(message)
        if (typeof client.decryptFile === 'function') {
          return await client.decryptFile(message);
        }
        throw new Error('decryptFile não disponível');
        
      default:
        // Tentar métodos conhecidos em ordem de prioridade
        if (typeof client.decryptFile === 'function') {
          return await client.decryptFile(message);
        } else if (typeof client.downloadMedia === 'function') {
          const media = await client.downloadMedia(message);
          if (media && media.data) {
            return Buffer.from(media.data, 'base64');
          }
        } else if (message.downloadMedia && typeof message.downloadMedia === 'function') {
          const media = await message.downloadMedia();
          if (media && media.data) {
            return Buffer.from(media.data, 'base64');
          }
        }
        
        throw new Error(`Nenhum método de descriptografia suportado para engine: ${engine}`);
    }
  } catch (err) {
    customLogger.error(`[MediaDecryptor] Falha ao descriptografar (${engine}): ${err.message}`);
    throw new Error(`Erro na descriptografia: ${err.message}`);
  }
}

module.exports = { decryptFile, detectEngine };
