const { Op } = require('sequelize');
const config = require('../config');
const CacheModel = require('../Models/cache');
const customLogger = require('../util/customLogger');

const CacheDB = CacheModel(config.sequelize);

let intervalHandle = null;

/**
 * 🚀 Job de limpeza automática do cache
 * Remove registros antigos do banco de dados de cache
 */
function startCacheCleanupJob() {
  const diasRetencao = parseInt(process.env.CACHE_RETENTION_DAYS, 10) || 7;
  
  // Executar a cada 24 horas
  const INTERVAL = 24 * 60 * 60 * 1000;
  
  intervalHandle = setInterval(async () => {
    await executarLimpeza(diasRetencao);
  }, INTERVAL);
  
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }
  
  // Executar uma vez ao iniciar (após 5 minutos)
  setTimeout(() => {
    executarLimpeza(diasRetencao);
  }, 5 * 60 * 1000);
  
  customLogger.info(`[CACHE CLEANUP] Job agendado (24h, retenção: ${diasRetencao} dias)`);
}

async function executarLimpeza(diasRetencao) {
  try {
    customLogger.info('[CACHE CLEANUP] Iniciando limpeza...');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - diasRetencao);
    
    const deleted = await CacheDB.destroy({
      where: {
        created_at: { [Op.lt]: cutoffDate } // 🔧 CORRIGIDO: usar created_at (snake_case)
      }
    });
    
    customLogger.success(`[CACHE CLEANUP] ${deleted} registros removidos`);
    return deleted;
    
  } catch (err) {
    customLogger.error(`[CACHE CLEANUP] Erro: ${err.message}`);
  }
}

module.exports = { startCacheCleanupJob };
