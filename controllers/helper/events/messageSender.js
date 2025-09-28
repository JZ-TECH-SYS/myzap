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

module.exports = { sendText, startTyping, stopTyping, detectEngine };
