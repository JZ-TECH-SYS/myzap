const fs = require('fs');
const path = require('path');
const customLogger = require('./customLogger.js');

/**
 * Utilitário para limpar instâncias travadas do WppConnect
 * Resolve problemas de arquivos EBUSY no Windows
 */
class InstanceCleaner {
  
  /**
   * Remove instâncias antigas ou travadas
   */
  static async cleanStuckInstances() {
    try {
      const instancesDir = path.join(process.cwd(), 'instances'); // ✅ Usar process.cwd()
      
      if (!fs.existsSync(instancesDir)) {
        customLogger.info('Diretório instances não existe');
        return;
      }
      
      const sessions = fs.readdirSync(instancesDir);
      
      for (const session of sessions) {
        const sessionPath = path.join(instancesDir, session);
        
        try {
          // Verifica se é um diretório
          if (fs.statSync(sessionPath).isDirectory()) {
            await this.cleanSessionWithRetry(sessionPath, session);
          }
        } catch (error) {
          customLogger.warn(`Erro ao processar sessão ${session}:`, error.message);
        }
      }
      
    } catch (error) {
      customLogger.error('Erro ao limpar instâncias:', error);
    }
  }

  /**
   * Mata TODOS os processos Chrome/Chromium para resolver "Code: 21"
   */
  static async killAllChromeProcesses() {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      customLogger.info(`[KILL-CHROME] 🔫 Matando todos os processos Chrome/Chromium...`);
      
      // Lista completa de processos relacionados ao Chrome que podem causar conflito
      const processesToKill = [
        'chrome.exe',
        'chromium.exe', 
        'msedge.exe',
        'brave.exe',
        'opera.exe'
      ];
      
      for (const processName of processesToKill) {
        try {
          // Mata processo com força total
          await execPromise(`taskkill /f /im ${processName} /t`);
          customLogger.info(`[KILL-CHROME] ✅ ${processName} terminado`);
        } catch (killErr) {
          // Ignorar erro se processo não existe
          if (killErr.message.includes('não foi encontrado')) {
            customLogger.debug(`[KILL-CHROME] ${processName} não estava rodando`);
          } else {
            customLogger.debug(`[KILL-CHROME] Erro ao matar ${processName}:`, killErr.message);
          }
        }
      }
      
      // Aguardar processos terminarem completamente
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      customLogger.success(`[KILL-CHROME] ✅ Limpeza de processos Chrome concluída`);
      return true;
      
    } catch (error) {
      customLogger.error(`[KILL-CHROME] ❌ Erro ao matar processos Chrome:`, error);
      return false;
    }
  }

  /**
   * 🔥 Cleanup agressivo para force reconnect - mata processos Chrome travados
   */
  static async aggressiveCleanupForReconnect(session) {
    try {
      customLogger.info(`[AGGRESSIVE-CLEANUP] Iniciando limpeza agressiva para ${session}`);
      
      // ✅ 1. Matar processos Chrome que podem estar travados
      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execPromise = util.promisify(exec);
        
        // Mata processos Chrome específicos da sessão
        await execPromise(`taskkill /f /im chrome.exe /t`).catch(() => {});
        await execPromise(`taskkill /f /im chromium.exe /t`).catch(() => {});
        
        customLogger.info(`[AGGRESSIVE-CLEANUP] Processos Chrome terminados`);
      } catch (killErr) {
        customLogger.warning(`[AGGRESSIVE-CLEANUP] Erro ao matar processos:`, killErr.message);
      }
      
      // ✅ 2. Aguardar processos terminarem
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // ✅ 3. Tentar remover userDataDir
      const sessionPath = path.join(process.cwd(), 'instances', session);
      if (fs.existsSync(sessionPath)) {
        await this.cleanSessionWithRetry(sessionPath, session, 5); // Mais retries
        customLogger.info(`[AGGRESSIVE-CLEANUP] UserDataDir limpo`);
      }
      
      customLogger.success(`[AGGRESSIVE-CLEANUP] ✅ Limpeza agressiva concluída para ${session}`);
      return true;
      
    } catch (error) {
      customLogger.error(`[AGGRESSIVE-CLEANUP] ❌ Erro na limpeza agressiva:`, error);
      return false;
    }
  }
  
  /**
   * Tenta remover uma sessão com retry
   */
  static async cleanSessionWithRetry(sessionPath, sessionName, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Verifica se há processos usando a pasta
        const isInUse = await this.isSessionInUse(sessionPath);
        
        if (isInUse && attempt < maxRetries) {
          customLogger.debug(`Sessão ${sessionName} em uso, tentativa ${attempt}/${maxRetries}`);
          await this.sleep(2000);
          continue;
        }
        
        // Tenta remover
        fs.rmSync(sessionPath, { recursive: true, force: true });
        customLogger.info(`✅ Sessão ${sessionName} removida com sucesso`);
        break;
        
      } catch (error) {
        if (attempt === maxRetries) {
          customLogger.warning(`⚠️ Não foi possível remover sessão ${sessionName}:`, error.message);
        } else {
          customLogger.debug(`Tentativa ${attempt}/${maxRetries} falhou para ${sessionName}`);
          await this.sleep(1000);
        }
      }
    }
  }
  
  /**
   * Verifica se uma sessão está em uso
   */
  static async isSessionInUse(sessionPath) {
    try {
      // Tenta fazer uma operação simples para verificar se está travado
      const files = fs.readdirSync(sessionPath);
      return false; // Se conseguiu listar, não está travado
    } catch (error) {
      if (error.code === 'EBUSY' || error.code === 'EPERM') {
        return true; // Está em uso
      }
      return false;
    }
  }
  
  /**
   * Sleep helper
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Limpa instâncias antigas (mais de 1 dia)
   */
  static async cleanOldInstances() {
    try {
      const instancesDir = path.join(__dirname, 'instances');
      
      if (!fs.existsSync(instancesDir)) {
        return;
      }
      
      const sessions = fs.readdirSync(instancesDir);
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      for (const session of sessions) {
        const sessionPath = path.join(instancesDir, session);
        
        try {
          const stats = fs.statSync(sessionPath);
          
          if (stats.isDirectory() && stats.mtime.getTime() < oneDayAgo) {
            customLogger.info(`🗑️ Removendo instância antiga: ${session}`);
            await this.cleanSessionWithRetry(sessionPath, session);
          }
        } catch (error) {
          customLogger.debug(`Erro ao verificar instância ${session}:`, error.message);
        }
      }
      
    } catch (error) {
      customLogger.error('Erro ao limpar instâncias antigas:', error);
    }
  }
}

module.exports = InstanceCleaner;
