const axios = require('axios');
const SessionsHelper = require('../controllers/helper/core/sessions.js');
const customLogger = require('../util/customLogger.js');
const config = require('../config');

const CONNECTED_STATUSES = new Set(['CONNECTED', 'inChat', 'isLogged', 'isConnected']);
const CONNECTED_STATES = new Set(['CONNECTED', 'inChat', 'isLogged', 'isConnected']);

// ✅ Status que indicam que a sessão está aguardando QR Code (NÃO tentar reiniciar)
const WAITING_QR_STATUSES = new Set(['qrCode', 'QRCODE', 'WAITING_QR', 'INITIALIZING', 'STARTING']);

// ✅ Configurações de controle de tentativas
const MAX_START_ATTEMPTS = 10; // ✅ AUMENTADO: Máximo de tentativas antes de parar
const QR_COOLDOWN_MINUTES = 5; // ✅ REDUZIDO: Minutos de espera entre tentativas quando tem QR

let intervalHandle = null;
let timeoutHandle = null;
let running = false;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shouldRunOnThisProcess() {
  const pmId = process.env.pm_id ?? process.env.PM_ID;
  return !pmId || pmId === '0';
}

function resolveBaseUrl() {
  const normalized = (config.host_ssl ?? '').trim();
  if (normalized) {
    return normalized.replace(/\/$/, '');
  }

  // ✅ CORRIGIDO - Usar config.host do .env ao invés de hardcoded 127.0.0.1
  const host = process.env.HOST || 'http://127.0.0.1';
  return `${host}:${config.port}`;
}

function isEligible(device) {
  if (!device?.session) {
    return false;
  }

  if (!device.sessionkey) {
    customLogger.warning(`[SESSION KEEPALIVE] Sessao ${device.session} ignorada: sessionkey ausente`);
    return false;
  }

  // ✅ NOVO - Verificar se está aguardando QR Code (NÃO tentar reiniciar)
  const status = device.status || '';
  const state = device.state || '';
  
  if (WAITING_QR_STATUSES.has(status) || WAITING_QR_STATUSES.has(state)) {
    // Verificar se já passou tempo suficiente desde a última tentativa
    const lastStart = device.last_start ? new Date(device.last_start) : null;
    const now = new Date();
    
    if (lastStart) {
      const minutesSinceLastStart = (now - lastStart) / (1000 * 60);
      
      if (minutesSinceLastStart < QR_COOLDOWN_MINUTES) {
        customLogger.debug(`[SESSION KEEPALIVE] ${device.session} aguardando QR (${minutesSinceLastStart.toFixed(1)} min) - pulando`);
        return false;
      }
    }
  }
  
  // ✅ NOVO - Verificar limite de tentativas
  const attemptsStart = device.attempts_start || 0;
  if (attemptsStart >= MAX_START_ATTEMPTS) {
    customLogger.debug(`[SESSION KEEPALIVE] ${device.session} atingiu limite de ${MAX_START_ATTEMPTS} tentativas - pulando`);
    return false;
  }

  // ✅ CORRIGIDO - Também reconectar sessões que caíram (DISCONNECTED, TIMEOUT, notLogged)
  const RECONNECT_STATUSES = new Set(['DISCONNECTED', 'TIMEOUT', 'notLogged', 'disconnected']);
  
  if (!config.session_keepalive_only_connected) {
    return true;
  }

  // ✅ Se está conectado OU se caiu e precisa reconectar
  if (CONNECTED_STATUSES.has(status) || CONNECTED_STATES.has(state)) {
    return true;
  }
  
  // ✅ NOVO - Também reconectar sessões que caíram
  if (RECONNECT_STATUSES.has(status) || RECONNECT_STATUSES.has(state)) {
    customLogger.info(`[SESSION KEEPALIVE] ${device.session} caiu (${status}/${state}) - tentando reconectar`);
    return true;
  }
  
  return false;
}

async function triggerStart(device, baseURL) {
  try {
    await axios.post(
      `${baseURL}/start`,
      { session: device.session },
      {
        headers: {
          apitoken: config.token,
          sessionkey: device.sessionkey,
        },
        timeout: 20000,
      }
    );

    customLogger.debug(`[SESSION KEEPALIVE] start enviado para ${device.session}`);
  } catch (error) {
    const errorMessage = error?.response?.data?.error || error?.message || 'Erro desconhecido';
    customLogger.warning(`[SESSION KEEPALIVE] Falha ao iniciar ${device.session}: ${errorMessage}`);
  }
}

async function runCycle() {
  if (running) {
    customLogger.debug('[SESSION KEEPALIVE] Ciclo anterior ainda em execucao, ignorando novo disparo');
    return;
  }

  running = true;
  const baseURL = resolveBaseUrl();

  try {
    const records = await SessionsHelper.listDevices();
    if (!records?.length) {
      customLogger.debug('[SESSION KEEPALIVE] Nenhuma sessao cadastrada no banco');
      return;
    }

    const devices = records
      .map((item) => (item?.dataValues ? { ...item.dataValues } : item))
      .filter((device) => isEligible(device));

    if (!devices.length) {
      customLogger.debug('[SESSION KEEPALIVE] Nenhuma sessao elegivel para keepalive');
      return;
    }

    customLogger.info(`[SESSION KEEPALIVE] Executando ciclo para ${devices.length} sessao(oes)`);

    for (const device of devices) {
      await triggerStart(device, baseURL);
      await wait(2000);
    }
  } catch (err) {
    customLogger.error(`[SESSION KEEPALIVE] Erro no ciclo: ${err.message}`);
  } finally {
    running = false;
  }
}

function startSessionKeepAliveJob() {
  if (!config.session_keepalive_enabled) {
    customLogger.info('[SESSION KEEPALIVE] Job desabilitado nas configuracoes');
    return;
  }

  if (!shouldRunOnThisProcess()) {
    customLogger.info('[SESSION KEEPALIVE] Ignorando agendamento neste worker PM2');
    return;
  }

  const interval = parseInt(config.session_keepalive_interval_ms, 10) || 300000;
  const initialDelay = Math.min(interval, 15000);

  const scheduleRecurring = () => {
    intervalHandle = setInterval(runCycle, interval);
    if (typeof intervalHandle.unref === 'function') {
      intervalHandle.unref();
    }
  };

  timeoutHandle = setTimeout(async () => {
    try {
      await runCycle();
    } finally {
      scheduleRecurring();
    }
  }, initialDelay);

  if (typeof timeoutHandle.unref === 'function') {
    timeoutHandle.unref();
  }

  customLogger.info(
    `[SESSION KEEPALIVE] Job agendado. Intervalo: ${interval}ms | Delay inicial: ${initialDelay}ms`
  );
}

module.exports = {
  startSessionKeepAliveJob,
};
