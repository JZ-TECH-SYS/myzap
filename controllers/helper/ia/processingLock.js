/**
 * Lock simples em memória para evitar processamento concorrente
 * do mesmo número. Resolve race conditions quando múltiplas mensagens
 * chegam de uma vez (ex: reinício do servidor).
 */

const locks = new Map();

function buildKey(session, sessionkey, numero) {
  return `${session || ''}::${sessionkey || ''}::${numero || ''}`;
}

/**
 * Tenta adquirir o lock para um número.
 * @param {Object} params
 * @param {string} params.session - ID da sessão
 * @param {string} params.sessionkey - Chave da sessão
 * @param {string} params.numero - Número do cliente
 * @returns {boolean} true se adquiriu o lock
 */
function acquire({ session, sessionkey, numero }) {
  const key = buildKey(session, sessionkey, numero);
  
  if (locks.has(key)) {
    return false;
  }
  
  locks.set(key, Date.now());
  return true;
}

/**
 * Libera o lock para um número.
 * @param {Object} params
 * @param {string} params.session - ID da sessão
 * @param {string} params.sessionkey - Chave da sessão
 * @param {string} params.numero - Número do cliente
 */
function release({ session, sessionkey, numero }) {
  const key = buildKey(session, sessionkey, numero);
  locks.delete(key);
}

/**
 * Verifica se há lock ativo para um número.
 * @param {Object} params
 * @param {string} params.session - ID da sessão
 * @param {string} params.sessionkey - Chave da sessão
 * @param {string} params.numero - Número do cliente
 * @returns {boolean} true se está travado
 */
function isLocked({ session, sessionkey, numero }) {
  const key = buildKey(session, sessionkey, numero);
  return locks.has(key);
}

/**
 * Limpa locks expirados (mais de 60 segundos).
 * Chamado periodicamente para evitar locks órfãos.
 */
function cleanup() {
  const now = Date.now();
  const LOCK_TIMEOUT_MS = 60000;
  
  for (const [key, timestamp] of locks.entries()) {
    if (now - timestamp > LOCK_TIMEOUT_MS) {
      locks.delete(key);
    }
  }
}

// Limpar locks expirados a cada 30 segundos
setInterval(cleanup, 30000);

module.exports = {
  acquire,
  release,
  isLocked,
};
