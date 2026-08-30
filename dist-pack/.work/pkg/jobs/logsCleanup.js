const fs = require('fs');
const path = require('path');
const customLogger = require('../util/customLogger');

let intervalHandle = null;

/**
 * 🚀 Job de limpeza de logs antigos
 * Remove arquivos de log com mais de X dias
 */
function startLogsCleanupJob() {
  const diasRetencao = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 7;
  
  // Executar a cada 24 horas às 4h da madrugada
  const now = new Date();
  const targetTime = new Date();
  targetTime.setHours(4, 0, 0, 0);
  
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const initialDelay = targetTime - now;
  
  setTimeout(() => {
    limparLogsAntigos(diasRetencao);
    
    intervalHandle = setInterval(() => {
      limparLogsAntigos(diasRetencao);
    }, 24 * 60 * 60 * 1000);
    
    if (typeof intervalHandle.unref === 'function') {
      intervalHandle.unref();
    }
  }, initialDelay);
  
  customLogger.info(`[LOGS CLEANUP] Job agendado para 4h (24h, retenção: ${diasRetencao} dias)`);
}

function limparLogsAntigos(diasRetencao) {
  try {
    const logsPath = path.join(__dirname, '..', 'logs');
    
    if (!fs.existsSync(logsPath)) {
      return;
    }
    
    const agora = Date.now();
    const cutoffTime = diasRetencao * 24 * 60 * 60 * 1000;
    
    const items = fs.readdirSync(logsPath);
    let arquivosRemovidos = 0;
    let pastasRemovidas = 0;
    
    items.forEach(item => {
      const itemPath = path.join(logsPath, item);
      
      try {
        const stats = fs.statSync(itemPath);
        const idade = agora - stats.mtime.getTime();
        
        if (idade > cutoffTime) {
          if (stats.isDirectory()) {
            fs.rmSync(itemPath, { recursive: true, force: true });
            customLogger.info(`[LOGS CLEANUP] Pasta removida: ${item}`);
            pastasRemovidas++;
          } else if (stats.isFile() && item !== 'debug.log' && item !== 'info.log' && item !== 'fatal.log') {
            fs.unlinkSync(itemPath);
            customLogger.info(`[LOGS CLEANUP] Arquivo removido: ${item}`);
            arquivosRemovidos++;
          }
        }
      } catch (err) {
        // Ignorar erros de permissão ou arquivos em uso
      }
    });
    
    if (arquivosRemovidos > 0 || pastasRemovidas > 0) {
      customLogger.success(`[LOGS CLEANUP] ${arquivosRemovidos} arquivos e ${pastasRemovidas} pastas removidos`);
    } else {
      customLogger.info('[LOGS CLEANUP] Nenhum item antigo para remover');
    }
    
  } catch (err) {
    customLogger.error(`[LOGS CLEANUP] Erro: ${err.message}`);
  }
}

module.exports = { startLogsCleanupJob };
