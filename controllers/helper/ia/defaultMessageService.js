const ChatHistoryHelper = require('../events/chatHistory');
const customLogger = require('../../../util/customLogger');
const { TEMPO_MENSAGEM_PADRAO_DEFAULT, LOG_PREFIX } = require('./iaConfig');

// 🔒 Lock para evitar race condition em envios paralelos
const sendingLocks = new Map();

function buildLockKey(session, sessionkey, numero) {
  return `${session}:${sessionkey}:${numero}`;
}

async function sendDefault({
  client,
  session,
  sessionkey,
  numero,
  mensagemPadrao,
  cooldownPadrao,
  motivo,
  force = false
}) {
  console.log('\n========== SEND DEFAULT ==========');
  console.log('SD1. sendDefault INICIADO');
  console.log('     numero:', numero);
  console.log('     motivo:', motivo);
  console.log('     mensagemPadrao:', mensagemPadrao ? mensagemPadrao.substring(0, 30) + '...' : 'VAZIO!');
  console.log('     force:', force);
  
  if (!mensagemPadrao) {
    console.log('SD2. ❌ mensagemPadrao VAZIA - retornando false');
    return false;
  }

  const lockKey = buildLockKey(session, sessionkey, numero);
  
  // Se já está enviando para este número, retornar false
  if (sendingLocks.has(lockKey)) {
    customLogger.debug(`${LOG_PREFIX} Lock ativo para ${numero}, ignorando envio duplicado`);
    return false;
  }

  // Adquirir lock
  sendingLocks.set(lockKey, Date.now());

  try {
    if (!force) {
      console.log('SD3. Verificando se já enviou hoje...');
      const jaEnviouHoje = await ChatHistoryHelper.jaEnvieiMensagemPadraoHoje({ session, sessionkey, numero });
      console.log('SD4. jaEnviouHoje:', jaEnviouHoje);
      if (jaEnviouHoje) {
        console.log('SD5. ❌ Já enviou hoje - retornando false');
        sendingLocks.delete(lockKey);
        return false;
      }
      console.log('SD5. ✅ Ainda não enviou hoje - continuando');
    }

    let sent = false;
    console.log('SD6. Tentando enviar mensagem...');
    try {
      const sender = require('../events/messageSender');
      console.log('SD7. Chamando sender.sendText...');
      sent = await sender.sendText({ client, to: numero, text: mensagemPadrao });
      console.log('SD8. sender.sendText retornou:', sent);
    } catch (sendErr) {
      console.log('SD8. ❌ Erro no sender.sendText:', sendErr.message);
      if (client) {
        if (typeof client.sendText === 'function') {
          await client.sendText(numero, mensagemPadrao);
          sent = true;
        } else if (typeof client.sendMessage === 'function') {
          await client.sendMessage(numero, mensagemPadrao);
          sent = true;
        }
      }
    }

    if (!sent) return false;

    // Registrar ANTES para evitar duplicatas em caso de race condition
    await ChatHistoryHelper.registerAssistantMessage({
      session,
      sessionkey,
      numero,
      text: mensagemPadrao,
      messageType: 'mensagem_padrao',
    });
    customLogger.info(`${LOG_PREFIX} Mensagem padrao enviada`, { session, numero, motivo, force });
    return true;
  } catch (err) {
    customLogger.error(`${LOG_PREFIX} Erro ao enviar mensagem padrão`, err.message || err);
    return false;
  } finally {
    // Sempre liberar o lock
    sendingLocks.delete(lockKey);
  }
}

// Limpar locks antigos a cada 5 minutos (proteção contra vazamento de memória)
setInterval(() => {
  const now = Date.now();
  const maxAge = 60000; // 1 minuto
  for (const [key, timestamp] of sendingLocks.entries()) {
    if (now - timestamp > maxAge) {
      sendingLocks.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = { sendDefault };
