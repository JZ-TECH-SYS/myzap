const fs = require('fs');
const path = require('path');
const customLogger = require('../util/customLogger');

let intervalHandle = null;

/**
 * 🚀 Job de limpeza de cache das instâncias WhatsApp
 * Remove cache do Chrome/Chromium acumulado nas pastas de sessões
 */
function startInstancesCleanupJob() {
  // Executar a cada 7 dias
  const INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 dias
  
  intervalHandle = setInterval(() => {
    limparCacheInstancias();
  }, INTERVAL);
  
  if (typeof intervalHandle.unref === 'function') {
    intervalHandle.unref();
  }
  
  // Executar uma vez ao iniciar (após 10 minutos)
  setTimeout(() => {
    limparCacheInstancias();
  }, 10 * 60 * 1000);
  
  customLogger.info('[INSTANCES CLEANUP] Job agendado (7 dias)');
}

function limparCacheInstancias() {
  try {
    customLogger.info('[INSTANCES CLEANUP] Iniciando limpeza...');
    
    const instancesPath = path.join(__dirname, '..', 'instances');
    
    if (!fs.existsSync(instancesPath)) {
      customLogger.warning('[INSTANCES CLEANUP] Pasta instances não encontrada');
      return;
    }
    
    const sessions = fs.readdirSync(instancesPath);
    let totalLimpo = 0;
    
    sessions.forEach(session => {
      const sessionPath = path.join(instancesPath, session);
      
      if (!fs.statSync(sessionPath).isDirectory()) {
        return;
      }
      
      // Limpar pastas de cache do Chrome (SEM TOCAR NA SESSÃO!)
      // ⚠️ IMPORTANTE: NÃO remove IndexedDB, Local Storage, Session Storage
      // para manter a sessão do WhatsApp ativa
      const cacheFolders = [
        'Default/Cache',              // Cache de imagens, scripts
        'Default/Code Cache',         // Cache de código compilado
        'Default/GPUCache',           // Cache da GPU
        'Default/Service Worker/CacheStorage', // Cache de Service Workers
        'ShaderCache',                // Cache de shaders gráficos
        'GPUCache',                   // Cache GPU adicional
        'Default/DawnCache',          // Cache Dawn (WebGPU)
        'Default/blob_storage',       // Blobs temporários
      ];
      
      // 🔒 PASTAS QUE NUNCA SERÃO TOCADAS (SESSÃO WHATSAPP):
      // - Default/IndexedDB          ← Dados da sessão WhatsApp
      // - Default/Local Storage      ← Tokens e autenticação
      // - Default/Session Storage    ← Sessão ativa
      // - .wwebjs_auth/              ← Credenciais (se existir)
      // - tokens/                    ← Tokens (se existir)
      
      cacheFolders.forEach(folder => {
        const cachePath = path.join(sessionPath, folder);
        
        if (fs.existsSync(cachePath)) {
          const tamanhoAntes = getFolderSize(cachePath);
          
          // 🔧 WINDOWS: Tentar até 3 vezes (arquivos podem estar em uso)
          let sucesso = false;
          for (let tentativa = 1; tentativa <= 3 && !sucesso; tentativa++) {
            try {
              fs.rmSync(cachePath, { recursive: true, force: true });
              customLogger.info(`[INSTANCES CLEANUP] ${session}/${folder} removido (${formatBytes(tamanhoAntes)})`);
              totalLimpo += tamanhoAntes;
              sucesso = true;
            } catch (err) {
              if ((err.code === 'EBUSY' || err.code === 'EPERM') && tentativa < 3) {
                customLogger.warning(`[INSTANCES CLEANUP] Arquivo em uso, tentativa ${tentativa}/3 - aguardando...`);
                // Aguardar 2 segundos (síncrono)
                const start = Date.now();
                while (Date.now() - start < 2000) {
                  // busy wait
                }
              } else if (err.code === 'EBUSY' || err.code === 'EPERM') {
                customLogger.warning(`[INSTANCES CLEANUP] ${folder} - Arquivo em uso após 3 tentativas, pulando`);
              } else {
                customLogger.error(`[INSTANCES CLEANUP] Erro ao remover ${cachePath}: ${err.message}`);
              }
            }
          }
        }
      });
    });
    
    customLogger.success(`[INSTANCES CLEANUP] Limpeza concluída - ${formatBytes(totalLimpo)} liberados`);
    
  } catch (err) {
    customLogger.error(`[INSTANCES CLEANUP] Erro: ${err.message}`);
  }
}

function getFolderSize(folderPath) {
  let size = 0;
  
  try {
    const files = fs.readdirSync(folderPath);
    
    files.forEach(file => {
      const filePath = path.join(folderPath, file);
      try {
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          size += getFolderSize(filePath);
        } else {
          size += stats.size;
        }
      } catch (err) {
        // Ignorar erros de permissão ou arquivos em uso
      }
    });
  } catch (err) {
    // Ignorar erros de permissão
  }
  
  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = { startInstancesCleanupJob };
