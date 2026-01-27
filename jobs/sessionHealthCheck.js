/**
 * Job de Health Check para Sessões WhatsApp
 * 
 * Detecta sessões "zumbi" que aparecem como conectadas mas não recebem mensagens.
 * 
 * MELHORADO: Agora também rastreia envios e fornece validação pré-envio.
 * - registerSendSuccess() / registerSendFailure() - rastreia envios
 * - isClientHealthy() - valida ANTES de enviar (usar no sendText)
 */

const SessionsHelper = require('../controllers/helper/core/sessions.js');
const customLogger = require('../util/customLogger.js');
const config = require('../config');
const DeviceModel = require('../Models/device.js');

const Device = DeviceModel(config.sequelize);

// 📊 Mapas de rastreamento
const lastMessageTime = new Map();        // Última msg recebida
const lastSendTime = new Map();           // Último envio OK
const lastSendError = new Map();          // Último erro de envio
const sendFailureCount = new Map();       // Falhas consecutivas de envio

// Mapa de último health check por sessão
const lastHealthCheck = new Map();

// Configurações - AJUSTADAS para detecção mais rápida
const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 segundos (era 1 minuto)
const ZOMBIE_THRESHOLD_MINUTES = 15; // 15 minutos (era 30) - Alertar mais cedo
const MAX_CONSECUTIVE_FAILURES = 2; // 2 falhas (era 3) - Reagir mais rápido
const MAX_SEND_FAILURES = 3;         // 3 falhas de envio → marcar como problemático
const RECOVERY_COOLDOWN_MS = 300000; // 5 min entre recuperações

// Contador de falhas por sessão
const failureCount = new Map();

// Última recuperação por sessão (para cooldown)
const lastRecoveryTime = new Map();

let intervalHandle = null;

/**
 * 📩 Registra timestamp da última mensagem recebida (chamar do EventsController)
 */
function registerMessageReceived(session) {
  lastMessageTime.set(session, Date.now());
  // Reset failure count quando recebe mensagem
  failureCount.set(session, 0);
  
  // Atualizar banco em background (não bloqueia)
  Device.update({ 
    last_message_received: new Date(),
    health_status: 'HEALTHY'
  }, { where: { session } }).catch(() => {});
}

/**
 * ✅ Registra envio bem sucedido (chamar do sendText/sendMedia)
 */
function registerSendSuccess(session) {
  lastSendTime.set(session, Date.now());
  sendFailureCount.set(session, 0);
  lastSendError.delete(session);
  
  // Atualizar banco em background
  Device.update({ 
    last_message_sent: new Date(),
    send_failure_count: 0,
    last_send_error: null,
    health_status: 'HEALTHY'
  }, { where: { session } }).catch(() => {});
}

/**
 * ❌ Registra falha de envio (chamar do sendText/sendMedia)
 */
function registerSendFailure(session, errorMessage) {
  const count = (sendFailureCount.get(session) || 0) + 1;
  sendFailureCount.set(session, count);
  lastSendError.set(session, { message: errorMessage, at: Date.now() });
  
  // Atualizar banco em background
  Device.update({ 
    send_failure_count: count,
    last_send_error: errorMessage,
    health_status: count >= MAX_SEND_FAILURES ? 'CRITICAL' : 'WARNING'
  }, { where: { session } }).catch(() => {});
  
  customLogger.warning(`[SEND FAILURE] ${session}: ${count} falhas consecutivas - ${errorMessage}`);
  
  if (count >= MAX_SEND_FAILURES) {
    customLogger.error(`[SEND FAILURE] ${session}: Atingiu ${MAX_SEND_FAILURES} falhas - sessão problemática`);
  }
}

/**
 * 🔍 Verifica se client está saudável ANTES de enviar (usar no sendText)
 * Retorna { healthy: boolean, reason: string|null, skipFailureCount: boolean }
 * 
 * skipFailureCount=true significa que NÃO devemos incrementar o contador de falhas
 * (usado quando o bloqueio é por já ter muitas falhas - evita loop infinito)
 */
async function isClientHealthy(session, client) {
  if (!client) {
    return { healthy: false, reason: 'Client não existe na memória', skipFailureCount: false };
  }

  // Verificar falhas de envio recentes
  // 🔴 IMPORTANTE: Se bloqueou por muitas falhas, NÃO incrementar mais
  // Isso evita loop infinito de falhas
  const sendFails = sendFailureCount.get(session) || 0;
  if (sendFails >= MAX_SEND_FAILURES) {
    return { 
      healthy: false, 
      reason: `${sendFails} falhas de envio consecutivas - aguardando recuperação automática`,
      skipFailureCount: true  // NÃO incrementar - evita loop!
    };
  }

  // Verificação rápida do estado (timeout de 5s para não travar)
  try {
    const statePromise = Promise.race([
      client.getState(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    
    const state = await statePromise;
    
    if (state !== 'CONNECTED') {
      return { healthy: false, reason: `Estado: ${state}`, skipFailureCount: false };
    }
    
    return { healthy: true, reason: null, state, skipFailureCount: false };
  } catch (error) {
    return { healthy: false, reason: error.message, skipFailureCount: false };
  }
}

/**
 * Verifica se uma sessão está "zumbi"
 */
async function checkSessionHealth(session, client) {
  const checks = {
    session,
    timestamp: new Date().toISOString(),
    getState: null,
    pupPageAlive: null,
    lastMessage: null,
    lastSend: null,
    sendFailures: sendFailureCount.get(session) || 0,
    isZombie: false,
    reason: null
  };

  try {
    // 1. Verificar getState()
    const statePromise = new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('getState timeout')), 10000);
      try {
        const state = await client.getState();
        clearTimeout(timeout);
        resolve(state);
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    });

    checks.getState = await statePromise;
    
    // 2. Verificar se página do Puppeteer ainda responde
    if (client.pupPage) {
      const pagePromise = new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('pupPage timeout')), 10000);
        try {
          const result = await client.pupPage.evaluate(() => 1 + 1);
          clearTimeout(timeout);
          resolve(result === 2);
        } catch (e) {
          clearTimeout(timeout);
          reject(e);
        }
      });

      checks.pupPageAlive = await pagePromise;
    }

    // 3. Verificar tempo desde última mensagem
    const lastMsg = lastMessageTime.get(session);
    if (lastMsg) {
      const minutesSinceLastMessage = (Date.now() - lastMsg) / 60000;
      checks.lastMessage = {
        timestamp: new Date(lastMsg).toISOString(),
        minutesAgo: Math.round(minutesSinceLastMessage)
      };

      if (minutesSinceLastMessage > ZOMBIE_THRESHOLD_MINUTES) {
        checks.isZombie = true;
        checks.reason = `Sem mensagens há ${Math.round(minutesSinceLastMessage)} minutos`;
      }
    }

    // 4. Verificar último envio bem sucedido
    const lastSnd = lastSendTime.get(session);
    if (lastSnd) {
      checks.lastSend = {
        timestamp: new Date(lastSnd).toISOString(),
        minutesAgo: Math.round((Date.now() - lastSnd) / 60000)
      };
    }

    // 5. 🆕 Verificar falhas de envio consecutivas
    if (checks.sendFailures >= MAX_SEND_FAILURES) {
      checks.isZombie = true;
      checks.reason = `${checks.sendFailures} falhas de envio consecutivas`;
    }

    // Reset failure count em caso de sucesso
    failureCount.set(session, 0);

  } catch (error) {
    const currentFailures = (failureCount.get(session) || 0) + 1;
    failureCount.set(session, currentFailures);

    checks.error = error.message;

    if (currentFailures >= MAX_CONSECUTIVE_FAILURES) {
      checks.isZombie = true;
      checks.reason = `${currentFailures} falhas consecutivas: ${error.message}`;
    }
  }

  lastHealthCheck.set(session, checks);
  return checks;
}

/**
 * Executa health check em todas as sessões conectadas
 */
async function runHealthCheckCycle() {
  try {
    const allSessions = SessionsHelper.getAllSessions();
    
    if (!allSessions || allSessions.length === 0) {
      customLogger.debug('[HEALTH CHECK] Nenhuma sessão ativa na memória');
      return;
    }

    const results = {
      total: allSessions.length,
      healthy: 0,
      warning: 0,
      zombie: 0,
      details: []
    };

    for (const sessionInfo of allSessions) {
      const { session, client } = sessionInfo;
      
      if (!client) {
        results.warning++;
        continue;
      }

      const health = await checkSessionHealth(session, client);
      results.details.push(health);

      if (health.isZombie) {
        results.zombie++;
        customLogger.error(`[🧟 ZOMBIE DETECTED] ${session}: ${health.reason}`);
        
        // Atualizar banco para marcar como ZOMBIE
        await Device.update({
          state: 'ZOMBIE',
          status: 'ZOMBIE',
          updated_at: new Date()
        }, { where: { session } }).catch(() => {});

        // 🔄 RECONEXÃO AUTOMÁTICA - Tentar reviver a sessão zumbi
        try {
          customLogger.warning(`[🔄 AUTO-RECONNECT] ${session}: Tentando reviver sessão zumbi...`);
          
          // Verificar condições que exigem destroy completo (refresh não resolve)
          const isDetachedFrame = health.reason && health.reason.includes('detached Frame');
          const hasManyFailures = health.sendFailures >= MAX_SEND_FAILURES;
          const isBrowserRunning = health.reason && health.reason.includes('browser is already running');
          
          // 🔴 Se tem muitas falhas de envio, precisa destruir e recriar
          const needsFullRestart = isDetachedFrame || hasManyFailures || isBrowserRunning;
          
          if (needsFullRestart) {
            // Sessão irrecuperável com refresh, precisa destruir e recriar
            const reason = isDetachedFrame ? 'Frame detached' : 
                          hasManyFailures ? `${health.sendFailures} falhas de envio` :
                          'Browser já rodando';
            customLogger.warning(`[AUTO-RECONNECT] ${session}: ${reason} - destruindo cliente para restart...`);
            
            try {
              // Tentar fechar o cliente de forma limpa
              await client.destroy().catch(() => {});
            } catch (e) {
              customLogger.debug(`[AUTO-RECONNECT] ${session}: Ignorando erro ao destruir: ${e.message}`);
            }
            
            // Remover da lista de sessões ativas
            SessionsHelper.removeClientFromMemory(session);
            
            // 🔴 IMPORTANTE: Limpar contadores de falha para permitir nova tentativa!
            lastMessageTime.delete(session);
            failureCount.delete(session);
            lastHealthCheck.delete(session);
            sendFailureCount.delete(session);  // 🆕 Limpar falhas de envio!
            lastSendError.delete(session);      // 🆕 Limpar último erro de envio!
            
            // Atualizar banco para marcar como desconectado (sessionKeepAlive vai recriar)
            await Device.update({
              state: 'disconnected',
              status: 'disconnected',
              send_failure_count: 0,  // 🆕 Resetar no banco também!
              last_send_error: null,
              health_status: 'RECOVERING',
              qrcode: null,
              updated_at: new Date()
            }, { where: { session } }).catch(() => {});
            
            customLogger.warning(`[AUTO-RECONNECT] ${session}: Cliente destruído - sessionKeepAlive vai reiniciar em breve`);
            
          } else if (client.pupPage && !client.pupPage.isClosed()) {
            // Tentar refresh da página (para casos menos graves)
            customLogger.info(`[AUTO-RECONNECT] ${session}: Refreshing page...`);
            await client.pupPage.reload({ waitUntil: 'networkidle0', timeout: 30000 }).catch(e => {
              customLogger.warning(`[AUTO-RECONNECT] ${session}: Refresh falhou: ${e.message}`);
            });
            
            // Aguardar um pouco e verificar se voltou
            await new Promise(r => setTimeout(r, 5000));
            
            const newState = await client.getState().catch(() => 'UNKNOWN');
            customLogger.info(`[AUTO-RECONNECT] ${session}: Novo estado após refresh: ${newState}`);
            
            if (newState === 'CONNECTED') {
              customLogger.success(`[✅ REVIVED] ${session}: Sessão revivida com sucesso!`);
              // Reset do timestamp para dar mais tempo
              lastMessageTime.set(session, Date.now());
              failureCount.set(session, 0);
              
              // Atualizar banco
              await Device.update({
                state: 'CONNECTED',
                status: 'CONNECTED',
                updated_at: new Date()
              }, { where: { session } }).catch(() => {});
            }
          }
        } catch (reconnectError) {
          customLogger.error(`[AUTO-RECONNECT] ${session}: Erro na reconexão: ${reconnectError.message}`);
        }

      } else if (health.getState !== 'CONNECTED') {
        results.warning++;
        customLogger.warning(`[HEALTH CHECK] ${session}: state=${health.getState}`);
      } else {
        results.healthy++;
      }
    }

    // Log resumo
    if (results.zombie > 0 || results.warning > 0) {
      customLogger.warning(
        `[HEALTH CHECK] Total: ${results.total} | ` +
        `✅ Healthy: ${results.healthy} | ` +
        `⚠️ Warning: ${results.warning} | ` +
        `🧟 Zombie: ${results.zombie}`
      );
    } else {
      customLogger.debug(`[HEALTH CHECK] ${results.total} sessão(ões) OK`);
    }

  } catch (error) {
    customLogger.error(`[HEALTH CHECK] Erro no ciclo: ${error.message}`);
  }
}

/**
 * Inicia o job de health check
 */
function startHealthCheckJob() {
  // Verificar se deve rodar neste processo (PM2 cluster)
  const pmId = process.env.pm_id ?? process.env.PM_ID;
  if (pmId && pmId !== '0') {
    customLogger.info('[HEALTH CHECK] Ignorando neste worker PM2');
    return;
  }

  // Delay inicial de 2 minutos para dar tempo das sessões conectarem
  const initialDelay = 120000;

  setTimeout(() => {
    // Primeiro ciclo
    runHealthCheckCycle();

    // Agendar ciclos recorrentes
    intervalHandle = setInterval(runHealthCheckCycle, HEALTH_CHECK_INTERVAL_MS);
    if (typeof intervalHandle.unref === 'function') {
      intervalHandle.unref();
    }
  }, initialDelay);

  customLogger.info(
    `[HEALTH CHECK] Job agendado. Intervalo: ${HEALTH_CHECK_INTERVAL_MS}ms | ` +
    `Threshold zumbi: ${ZOMBIE_THRESHOLD_MINUTES} min | ` +
    `Delay inicial: ${initialDelay}ms`
  );
}

/**
 * Para o job de health check
 */
function stopHealthCheckJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    customLogger.info('[HEALTH CHECK] Job parado');
  }
}

/**
 * Retorna estatísticas do health check
 */
function getHealthStats() {
  return {
    lastMessageTimes: Object.fromEntries(lastMessageTime),
    lastSendTimes: Object.fromEntries(lastSendTime),
    sendFailureCounts: Object.fromEntries(sendFailureCount),
    lastHealthChecks: Object.fromEntries(lastHealthCheck),
    failureCounts: Object.fromEntries(failureCount)
  };
}

module.exports = {
  startHealthCheckJob,
  stopHealthCheckJob,
  registerMessageReceived,
  registerSendSuccess,
  registerSendFailure,
  isClientHealthy,
  checkSessionHealth,
  getHealthStats
};
