/**
 * Job de Health Check para Sessões WhatsApp
 * 
 * Detecta sessões "zumbi" que aparecem como conectadas mas não recebem mensagens.
 * 
 * PROBLEMA: Sessão aparece CONNECTED no banco, mas client travou ou parou de processar eventos.
 * SOLUÇÃO: Verificar periodicamente se o client responde e detectar gaps de mensagens.
 */

const SessionsHelper = require('../controllers/helper/core/sessions.js');
const customLogger = require('../util/customLogger.js');
const config = require('../config');
const DeviceModel = require('../Models/device.js');

const Device = DeviceModel(config.sequelize);

// Mapa de última mensagem recebida por sessão
const lastMessageTime = new Map();

// Mapa de último health check por sessão
const lastHealthCheck = new Map();

// Configurações - AJUSTADAS para detecção mais rápida
const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 segundos (era 1 minuto)
const ZOMBIE_THRESHOLD_MINUTES = 15; // 15 minutos (era 30) - Alertar mais cedo
const MAX_CONSECUTIVE_FAILURES = 2; // 2 falhas (era 3) - Reagir mais rápido

// Contador de falhas por sessão
const failureCount = new Map();

let intervalHandle = null;

/**
 * Registra timestamp da última mensagem recebida (chamar do EventsController)
 */
function registerMessageReceived(session) {
  lastMessageTime.set(session, Date.now());
  // Reset failure count quando recebe mensagem
  failureCount.set(session, 0);
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
          
          // Verificar se é erro de "detached Frame" - nesse caso, refresh não vai funcionar
          const isDetachedFrame = health.reason && health.reason.includes('detached Frame');
          
          if (isDetachedFrame) {
            // Frame detached = sessão irrecuperável, precisa destruir e recriar
            customLogger.warning(`[AUTO-RECONNECT] ${session}: Frame detached detectado - destruindo cliente...`);
            
            try {
              // Tentar fechar o cliente de forma limpa
              await client.destroy().catch(() => {});
            } catch (e) {
              customLogger.debug(`[AUTO-RECONNECT] ${session}: Ignorando erro ao destruir: ${e.message}`);
            }
            
            // Remover da lista de sessões ativas
            SessionsHelper.removeClientFromMemory(session);
            
            // Limpar contadores
            lastMessageTime.delete(session);
            failureCount.delete(session);
            lastHealthCheck.delete(session);
            
            // Atualizar banco para marcar como desconectado (forçar novo QR)
            await Device.update({
              state: 'disconnected',
              status: 'disconnected',
              qrcode: null,
              updated_at: new Date()
            }, { where: { session } }).catch(() => {});
            
            customLogger.warning(`[AUTO-RECONNECT] ${session}: Sessão destruída - aguardando novo QR code`);
            
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
    lastHealthChecks: Object.fromEntries(lastHealthCheck),
    failureCounts: Object.fromEntries(failureCount)
  };
}

module.exports = {
  startHealthCheckJob,
  stopHealthCheckJob,
  registerMessageReceived,
  checkSessionHealth,
  getHealthStats
};
