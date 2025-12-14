/**
 * 📊 Job de Monitoramento por Instância
 * 
 * Coleta métricas de cada sessão/instância conectada para:
 * - Planejamento de capacidade
 * - Identificação de instâncias problemáticas
 * - Histórico de uso por cliente
 * 
 * Métricas coletadas:
 * - RAM estimada por instância
 * - Status de conexão
 * - Tempo de uptime
 * - Última atividade
 * 
 * @author JZ-TECH
 * @date 2025-12-14
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const customLogger = require('../util/customLogger');
const config = require('../config');
const emailAlertService = require('../services/emailAlertService');

// Modelos
const DeviceModel = require('../Models/device');
const Device = DeviceModel(config.sequelize);

let intervalHandle = null;

// ✅ Configurações
const METRICS_INTERVAL_MINUTES = parseInt(process.env.METRICS_INTERVAL_MINUTES, 10) || 5;
const METRICS_RETENTION_DAYS = parseInt(process.env.METRICS_RETENTION_DAYS, 10) || 7;

// ✅ Limites para alertas
const ALERTS = {
  RAM_PER_INSTANCE_MB: 1500,  // Alerta se instância usar > 1.5GB
  DISK_PER_INSTANCE_MB: 500,  // Alerta se cache > 500MB
};

/**
 * Inicia o job de métricas
 */
function startInstanceMetricsJob() {
  const interval = METRICS_INTERVAL_MINUTES * 60 * 1000;
  
  // Primeira execução após 2 minutos
  setTimeout(() => {
    collectMetrics();
  }, 2 * 60 * 1000);
  
  // Execuções periódicas
  intervalHandle = setInterval(() => {
    collectMetrics();
  }, interval);
  
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }
  
  customLogger.info(`[INSTANCE METRICS] Job agendado (${METRICS_INTERVAL_MINUTES} minutos)`);
}

/**
 * Coleta métricas de todas as instâncias
 */
async function collectMetrics() {
  try {
    const devices = await Device.findAll();
    const instancesPath = path.join(process.cwd(), 'instances');
    
    const metrics = {
      timestamp: new Date().toISOString(),
      system: getSystemMetrics(),
      instances: {},
      totals: {
        total: 0,
        connected: 0,
        waiting_qr: 0,
        disconnected: 0,
        disk_mb: 0
      }
    };
    
    for (const device of devices) {
      const session = device.session;
      const sessionPath = path.join(instancesPath, session);
      
      // Calcular tamanho do disco
      const diskMB = getDirSizeMB(sessionPath);
      
      // Determinar status
      const status = device.status || 'unknown';
      const state = device.state || 'unknown';
      const isConnected = ['CONNECTED', 'inChat', 'isLogged', 'isConnected'].includes(status);
      const isWaitingQR = ['qrCode', 'QRCODE', 'WAITING_QR'].includes(status);
      
      // Calcular uptime
      const lastConnect = device.last_connect ? new Date(device.last_connect) : null;
      const uptimeHours = lastConnect && isConnected 
        ? ((Date.now() - lastConnect.getTime()) / (1000 * 60 * 60)).toFixed(2)
        : 0;
      
      metrics.instances[session] = {
        status,
        state,
        connected: isConnected,
        disk_mb: diskMB,
        uptime_hours: parseFloat(uptimeHours),
        last_connect: device.last_connect,
        last_disconnect: device.last_disconnect,
        attempts_start: device.attempts_start || 0,
        number: device.number || null,
        pushname: device.pushname || null
      };
      
      // Atualizar totais
      metrics.totals.total++;
      metrics.totals.disk_mb += diskMB;
      
      if (isConnected) {
        metrics.totals.connected++;
      } else if (isWaitingQR) {
        metrics.totals.waiting_qr++;
      } else {
        metrics.totals.disconnected++;
      }
      
      // ✅ Verificar alertas por instância
      if (diskMB > ALERTS.DISK_PER_INSTANCE_MB) {
        customLogger.warning(`[INSTANCE METRICS] ⚠️ ${session} - Disco alto: ${diskMB}MB (limite: ${ALERTS.DISK_PER_INSTANCE_MB}MB)`);
      }
    }
    
    // Calcular RAM estimada por instância conectada
    // Cada instância conectada usa aproximadamente 800MB-1.2GB
    const processMemory = process.memoryUsage();
    const estimatedRamPerInstance = metrics.totals.connected > 0
      ? Math.round((processMemory.rss / 1024 / 1024) / metrics.totals.connected)
      : 0;
    
    metrics.totals.estimated_ram_per_instance_mb = estimatedRamPerInstance;
    metrics.totals.process_rss_mb = Math.round(processMemory.rss / 1024 / 1024);
    metrics.totals.process_heap_mb = Math.round(processMemory.heapUsed / 1024 / 1024);
    
    // Salvar métricas em arquivo
    await saveMetrics(metrics);
    
    // Log resumido
    customLogger.info(`[INSTANCE METRICS] Coletado: ${metrics.totals.total} instâncias | ` +
      `${metrics.totals.connected} conectadas | ` +
      `${metrics.totals.waiting_qr} aguardando QR | ` +
      `Disco: ${metrics.totals.disk_mb}MB`);
    
    return metrics;
    
  } catch (err) {
    customLogger.error(`[INSTANCE METRICS] Erro ao coletar métricas: ${err.message}`);
    return null;
  }
}

/**
 * Obtém métricas do sistema
 */
function getSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    total_memory_mb: Math.round(totalMem / 1024 / 1024),
    free_memory_mb: Math.round(freeMem / 1024 / 1024),
    used_memory_mb: Math.round(usedMem / 1024 / 1024),
    used_percent: ((usedMem / totalMem) * 100).toFixed(2),
    cpus: os.cpus().length,
    platform: os.platform(),
    uptime_hours: (os.uptime() / 3600).toFixed(2)
  };
}

/**
 * Calcula tamanho de um diretório em MB
 */
function getDirSizeMB(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      return 0;
    }
    
    let totalSize = 0;
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      
      if (file.isDirectory()) {
        totalSize += getDirSizeMB(filePath) * 1024 * 1024; // Converter de volta para bytes
      } else {
        try {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
        } catch (e) {
          // Ignorar arquivos que não podem ser lidos
        }
      }
    }
    
    return Math.round(totalSize / 1024 / 1024); // Retornar em MB
  } catch (err) {
    return 0;
  }
}

/**
 * Salva métricas em arquivo JSON
 */
async function saveMetrics(metrics) {
  try {
    const metricsDir = path.join(process.cwd(), 'logs', 'metrics');
    
    // Criar diretório se não existir
    if (!fs.existsSync(metricsDir)) {
      fs.mkdirSync(metricsDir, { recursive: true });
    }
    
    // Nome do arquivo: YYYY-MM-DD.json
    const today = new Date().toISOString().split('T')[0];
    const filePath = path.join(metricsDir, `${today}.json`);
    
    // Ler arquivo existente ou criar array vazio
    let dailyMetrics = [];
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        dailyMetrics = JSON.parse(content);
      } catch (e) {
        dailyMetrics = [];
      }
    }
    
    // Adicionar nova métrica
    dailyMetrics.push(metrics);
    
    // Salvar arquivo
    fs.writeFileSync(filePath, JSON.stringify(dailyMetrics, null, 2));
    
    // Limpar métricas antigas
    cleanOldMetrics();
    
  } catch (err) {
    customLogger.error(`[INSTANCE METRICS] Erro ao salvar métricas: ${err.message}`);
  }
}

/**
 * Limpa arquivos de métricas antigas
 */
function cleanOldMetrics() {
  try {
    const metricsDir = path.join(process.cwd(), 'logs', 'metrics');
    
    if (!fs.existsSync(metricsDir)) {
      return;
    }
    
    const files = fs.readdirSync(metricsDir);
    const now = Date.now();
    const retentionMs = METRICS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filePath = path.join(metricsDir, file);
      const stats = fs.statSync(filePath);
      
      if (now - stats.mtimeMs > retentionMs) {
        fs.unlinkSync(filePath);
        customLogger.info(`[INSTANCE METRICS] 🗑️ Métricas antigas removidas: ${file}`);
      }
    }
  } catch (err) {
    // Ignorar erros de limpeza
  }
}

/**
 * Obtém as métricas mais recentes
 */
async function getLatestMetrics() {
  return collectMetrics();
}

/**
 * Obtém histórico de métricas de um dia
 */
function getMetricsHistory(date = null) {
  try {
    const metricsDir = path.join(process.cwd(), 'logs', 'metrics');
    const targetDate = date || new Date().toISOString().split('T')[0];
    const filePath = path.join(metricsDir, `${targetDate}.json`);
    
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return [];
  }
}

/**
 * Para o job
 */
function stopInstanceMetricsJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    customLogger.info('[INSTANCE METRICS] Job parado');
  }
}

module.exports = {
  startInstanceMetricsJob,
  stopInstanceMetricsJob,
  collectMetrics,
  getLatestMetrics,
  getMetricsHistory
};
