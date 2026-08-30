/**
 * 🚀 Configuração do PM2 para MyZap
 * 
 * Este arquivo centraliza todas as configurações do PM2 para o ambiente de produção.
 * 
 * Uso:
 *   pm2 start ecosystem.config.js
 *   pm2 delete myzap && pm2 start ecosystem.config.js
 * 
 * Recursos configurados:
 * - max_memory_restart: Reinicia automaticamente se usar mais de 1GB de RAM
 * - node_args: Define 1GB de heap para o Node.js (com 31GB RAM disponível, é conservador)
 * - Logs organizados por tipo
 * - Variáveis de ambiente de produção
 * 
 * @author JZ-TECH
 * @date 2025-12-14
 */

module.exports = {
  apps: [{
    // ═══════════════════════════════════════════════════════════
    // CONFIGURAÇÕES BÁSICAS
    // ═══════════════════════════════════════════════════════════
    name: 'myzap',
    script: 'index.js',
    
    // ═══════════════════════════════════════════════════════════
    // CONFIGURAÇÕES DE MEMÓRIA
    // ═══════════════════════════════════════════════════════════
    // Reiniciar automaticamente se usar mais de 1GB de RAM
    // Com 31GB disponíveis, isso é bem conservador e seguro
    max_memory_restart: '1G',
    
    // Definir 1GB de heap para o Node.js
    // Isso permite que o GC trabalhe com mais espaço antes de ficar crítico
    node_args: '--max-old-space-size=1024',
    
    // ═══════════════════════════════════════════════════════════
    // CONFIGURAÇÕES DE INSTÂNCIA
    // ═══════════════════════════════════════════════════════════
    // Modo fork (não cluster) - importante para WhatsApp sessions
    instances: 1,
    exec_mode: 'fork',
    
    // Não usar watch em produção
    watch: false,
    
    // ═══════════════════════════════════════════════════════════
    // CONFIGURAÇÕES DE RESTART
    // ═══════════════════════════════════════════════════════════
    // Tentar reiniciar até 10 vezes
    max_restarts: 10,
    
    // Esperar 4 segundos entre restarts
    restart_delay: 4000,
    
    // Se crashar 10 vezes em 1 minuto, parar de tentar
    min_uptime: '60s',
    
    // Exponential backoff restart delay (mais tempo entre restarts consecutivos)
    exp_backoff_restart_delay: 100,
    
    // ═══════════════════════════════════════════════════════════
    // CONFIGURAÇÕES DE LOG
    // ═══════════════════════════════════════════════════════════
    // Logs serão salvos em /root/.pm2/logs/ por padrão
    // Mas podemos personalizar:
    // output: './logs/pm2-out.log',
    // error: './logs/pm2-error.log',
    
    // Merge stdout e stderr em um único log
    merge_logs: true,
    
    // Adicionar timestamp nos logs
    time: true,
    
    // ═══════════════════════════════════════════════════════════
    // VARIÁVEIS DE AMBIENTE
    // ═══════════════════════════════════════════════════════════
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
