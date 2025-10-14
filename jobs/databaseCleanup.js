const config = require('../config');
const customLogger = require('../util/customLogger');

let intervalHandle = null;

/**
 * 🚀 Job de otimização do banco de dados SQLite
 * Executa VACUUM para desfragmentar e recuperar espaço
 */
function startDatabaseCleanupJob() {
  // Executar VACUUM a cada 7 dias às 3h
  const INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 dias
  
  // Calcular próxima execução às 3h
  const now = new Date();
  const targetTime = new Date();
  targetTime.setHours(3, 0, 0, 0);
  
  if (targetTime <= now) {
    targetTime.setDate(targetTime.getDate() + 1);
  }
  
  const initialDelay = targetTime - now;
  
  setTimeout(() => {
    executarVacuum();
    
    intervalHandle = setInterval(() => {
      executarVacuum();
    }, INTERVAL);
    
    if (typeof intervalHandle.unref === 'function') {
      intervalHandle.unref();
    }
  }, initialDelay);
  
  customLogger.info('[DATABASE CLEANUP] Job VACUUM agendado (7 dias, 3h)');
}

async function executarVacuum() {
  try {
    customLogger.info('[DATABASE CLEANUP] Iniciando VACUUM...');
    
    const startTime = Date.now();
    await config.sequelize.query('VACUUM;');
    const duration = Date.now() - startTime;
    
    customLogger.success(`[DATABASE CLEANUP] VACUUM concluído em ${duration}ms`);
    
  } catch (err) {
    customLogger.error(`[DATABASE CLEANUP] Erro ao executar VACUUM: ${err.message}`);
  }
}

module.exports = { startDatabaseCleanupJob };
