/**
 * Adapter unificado para envio de mensagens e indicadores de digitação
 * compatível com: WPPConnect, Venom, whatsapp-web.js.
 */
const customLogger = require('../../../util/customLogger');

async function detectEngine(client) {
  if (!client || typeof client !== 'object') return 'desconhecido';
  // Heurísticas simples
  if (client?.constructor?.name === 'Client' && client?.getChatById) return 'webjs';
  if (client?.sendText && client?.getWAVersion) return 'wppconnect';
  if (client?.sendText && client?.getSessionTokenBrowser) return 'venom';
  return 'generico';
}

/**
 * Verifica se um número está registrado no WhatsApp
 * @param {Object} client - Cliente do WhatsApp
 * @param {string} number - Número limpo (apenas dígitos)
 * @returns {Promise<Object|null>} Retorna o ID do WhatsApp ou null se não existir
 */
async function verifyNumber(client, number) {
  if (!client || !number) return null;
  const engine = await detectEngine(client);
  
  try {
    switch (engine) {
      case 'webjs':
        // whatsapp-web.js usa getNumberId()
        if (typeof client.getNumberId === 'function') {
          let numberId = await client.getNumberId(number);
          
          // Tenta sem o 9º dígito se o número tiver 13 dígitos (55 + DDD + 9 dígitos)
          if (!numberId && number.length === 13 && number.startsWith('55')) {
            const numberWithout9 = number.slice(0, 4) + number.slice(5);
            customLogger.info(`[MessageSender] Tentando sem o 9º dígito: ${numberWithout9}`);
            numberId = await client.getNumberId(numberWithout9);
          }
          
          // Tenta com o 9º dígito se o número tiver 12 dígitos (55 + DDD + 8 dígitos)
          if (!numberId && number.length === 12 && number.startsWith('55')) {
            const numberWith9 = number.slice(0, 4) + '9' + number.slice(4);
            customLogger.info(`[MessageSender] Tentando com o 9º dígito: ${numberWith9}`);
            numberId = await client.getNumberId(numberWith9);
          }
          
          return numberId; // Retorna objeto com _serialized ou null
        }
        break;
      case 'wppconnect':
      case 'venom':
        // WPPConnect/Venom usam checkNumberStatus()
        if (typeof client.checkNumberStatus === 'function') {
          const status = await client.checkNumberStatus(number);
          if (status?.numberExists) {
            return status?.id || { _serialized: `${number}@c.us` };
          }
          return null;
        }
        break;
      default:
        // Fallback - assume que existe
        return { _serialized: `${number}@c.us` };
    }
  } catch (err) {
    customLogger.error(`[MessageSender] Erro ao verificar número (${engine}): ${err.message}`);
  }
  return null;
}

async function sendText({ client, to, text }) {
  if (!client || !to || !text) return false;
  const engine = await detectEngine(client);
  try {
    switch (engine) {
      case 'webjs':
        // whatsapp-web.js -> sendMessage(chatId, content)
        await client.sendMessage(to, text);
        break;
      case 'wppconnect':
      case 'venom':
        // Ambos expõem sendText(number, text, [opts])
        await client.sendText(to, text);
        break;
      default:
        if (typeof client.sendText === 'function') {
          await client.sendText(to, text);
        } else if (typeof client.sendMessage === 'function') {
          await client.sendMessage(to, text);
        } else {
          throw new Error('Nenhum método de envio suportado (sendText / sendMessage)');
        }
    }
    return true;
  } catch (err) {
    customLogger.error(`[MessageSender] Falha ao enviar texto (${engine}) -> ${err.message}`);
    return false;
  }
}

async function startTyping({ client, to }) {
  if (!client || !to) return;
  const engine = await detectEngine(client);
  try {
    switch (engine) {
      case 'webjs': {
        if (!client.getChatById) return; // silencioso
        const chat = await client.getChatById(to);
        if (chat && chat.sendStateTyping) await chat.sendStateTyping();
        break; }
      case 'wppconnect':
      case 'venom':
        if (typeof client.startTyping === 'function') {
          await client.startTyping(to);
        }
        break;
      default:
        // no-op
        break;
    }
  } catch (err) {
    customLogger.warning(`[MessageSender] Erro startTyping (${engine}): ${err.message}`);
  }
}

async function stopTyping({ client, to }) {
  if (!client || !to) return;
  const engine = await detectEngine(client);
  try {
    switch (engine) {
      case 'webjs': {
        if (!client.getChatById) return; // silencioso
        const chat = await client.getChatById(to);
        if (chat && chat.sendStatePaused) await chat.sendStatePaused();
        break; }
      case 'wppconnect':
      case 'venom':
        if (typeof client.stopTyping === 'function') {
          await client.stopTyping(to);
        }
        break;
      default:
        break; // no-op
    }
  } catch (err) {
    customLogger.warning(`[MessageSender] Erro stopTyping (${engine}): ${err.message}`);
  }
}

module.exports = { sendText, startTyping, stopTyping, detectEngine, verifyNumber };
