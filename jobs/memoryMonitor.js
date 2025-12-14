const os = require('os');
const customLogger = require('../util/customLogger');
const emailAlertService = require('../services/emailAlertService');

let intervalHandle = null;

/**
 * 🚀 Job de monitoramento de memória
 * Reporta uso de memória do sistema e do processo a cada intervalo
 */
function startMemoryMonitorJob() {
  const intervaloMinutos = parseInt(process.env.MEMORY_MONITOR_INTERVAL_MINUTES, 10) || 15;
  const INTERVAL = intervaloMinutos * 60 * 1000;
  
  // Monitorar a cada X minutos
  intervalHandle = setInterval(() => {
    reportarUsoMemoria();
  }, INTERVAL);
  
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }
  
  // Reportar uma vez ao iniciar (após 1 minuto)
  setTimeout(() => {
    reportarUsoMemoria();
  }, 60 * 1000);
  
  customLogger.info(`[MEMORY MONITOR] Job agendado (${intervaloMinutos} minutos)`);
}

function reportarUsoMemoria() {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedPercent = ((usedMem / totalMem) * 100).toFixed(2);
    
    const processMemory = process.memoryUsage();
    
    customLogger.info(`[MEMORY] Sistema: ${formatBytes(usedMem)}/${formatBytes(totalMem)} (${usedPercent}%)`);
    customLogger.info(`[MEMORY] Processo: RSS=${formatBytes(processMemory.rss)} Heap=${formatBytes(processMemory.heapUsed)}/${formatBytes(processMemory.heapTotal)}`);
    
    // Alertar se memória crítica
    if (usedPercent > 85) {
      customLogger.warning(`⚠️ [MEMORY] Uso crítico de memória do sistema: ${usedPercent}%`);
      
      // 📧 Enviar alerta por email
      emailAlertService.send('MEMORY_CRITICAL', { 
        memoryPercent: parseFloat(usedPercent),
        totalMemory: formatBytes(totalMem),
        usedMemory: formatBytes(usedMem),
        freeMemory: formatBytes(freeMem),
        uptime: process.uptime()
      });
    }
    
    // Alertar se heap do processo está alto
    const heapPercent = (processMemory.heapUsed / processMemory.heapTotal) * 100;
    if (heapPercent > 90) {
      customLogger.warning(`⚠️ [MEMORY] Uso crítico de heap do processo: ${heapPercent.toFixed(2)}%`);
      
      // 📧 Enviar alerta por email
      emailAlertService.send('HEAP_CRITICAL', { 
        heapPercent: heapPercent,
        heapUsed: formatBytes(processMemory.heapUsed),
        heapTotal: formatBytes(processMemory.heapTotal),
        rss: formatBytes(processMemory.rss),
        external: formatBytes(processMemory.external),
        uptime: process.uptime()
      });
    }
    
  } catch (err) {
    customLogger.error(`[MEMORY MONITOR] Erro: ${err.message}`);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = { startMemoryMonitorJob };
