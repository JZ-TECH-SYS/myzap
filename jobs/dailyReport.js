/**
 * 📊 Job de Relatório Diário por Email
 * 
 * Envia um resumo diário com:
 * - Status das sessões (conectadas/desconectadas)
 * - Uso de memória e disco
 * - Alertas do dia
 * - Métricas gerais do sistema
 * 
 * Executa automaticamente às 8h da manhã
 * 
 * @author JZ-TECH
 * @date 2025-12-14
 */

const fs = require('fs');
const path = require('path');
const customLogger = require('../util/customLogger');
const emailService = require('../services/emailAlertService');

// Configurações
const REPORT_HOUR = parseInt(process.env.DAILY_REPORT_HOUR || '8'); // Hora do relatório (padrão 8h)
const REPORT_MINUTE = parseInt(process.env.DAILY_REPORT_MINUTE || '0');
const METRICS_DIR = path.join(__dirname, '..', 'logs', 'metrics');

class DailyReportJob {
    constructor() {
        this.isRunning = false;
        this.lastReportSent = null;
        this.intervalHandle = null;
        this.checkIntervalMs = 60000; // Verifica a cada 1 minuto
    }

    /**
     * Inicia o job de relatório diário
     */
    start() {
        // Verifica a cada minuto se é hora de enviar
        this.intervalHandle = setInterval(() => {
            this._checkAndSend();
        }, this.checkIntervalMs);

        // Verificar imediatamente ao iniciar
        this._checkAndSend();

        customLogger.info(`[DAILY REPORT] ✅ Job iniciado - Relatório será enviado às ${String(REPORT_HOUR).padStart(2, '0')}:${String(REPORT_MINUTE).padStart(2, '0')} (America/Sao_Paulo)`);
        
        return this;
    }

    /**
     * Verifica se é hora de enviar o relatório
     */
    _checkAndSend() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // Verificar se é a hora configurada
        if (currentHour === REPORT_HOUR && currentMinute === REPORT_MINUTE) {
            // Verificar se já enviou hoje
            if (this.lastReportSent) {
                const lastSentDate = new Date(this.lastReportSent).toDateString();
                const todayDate = now.toDateString();
                if (lastSentDate === todayDate) {
                    return; // Já enviou hoje
                }
            }
            
            this.sendDailyReport();
        }
    }

    /**
     * Para o job
     */
    stop() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
            customLogger.info('[DAILY REPORT] Job parado');
        }
    }

    /**
     * Envia o relatório diário
     */
    async sendDailyReport() {
        if (this.isRunning) {
            customLogger.warning('[DAILY REPORT] Já existe um relatório sendo gerado');
            return;
        }

        this.isRunning = true;
        customLogger.info('[DAILY REPORT] Gerando relatorio diario...');

        try {
            const report = await this.generateReport();
            const emailContent = this.formatEmailContent(report);
            
            const result = await emailService.enviar(
                emailService.destinatario,
                `Relatorio Diario MyZap - ${new Date().toLocaleDateString('pt-BR')}`,
                emailContent,
                { cc: emailService.cc }
            );

            // Verificar sucesso (API retorna result.sucesso ou result.result.sucesso)
            const isSuccess = result?.result?.sucesso || result?.sucesso || false;
            
            if (isSuccess) {
                this.lastReportSent = new Date();
                const idemail = result?.result?.idemail || result?.idemail || 'N/A';
                customLogger.info(`[DAILY REPORT] ✅ Relatório enviado com sucesso (idemail: ${idemail})`);
            } else {
                customLogger.error('[DAILY REPORT] ❌ Falha ao enviar relatório:', result?.error || result?.mensagem);
            }

            return result;
        } catch (error) {
            customLogger.error('[DAILY REPORT] ❌ Erro ao gerar relatório:', error.message);
            return { success: false, error: error.message };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Gera os dados do relatório
     */
    async generateReport() {
        const report = {
            generatedAt: new Date(),
            period: this.getReportPeriod(),
            sessions: await this.getSessionsStatus(),
            memory: this.getMemoryStatus(),
            metrics: await this.getMetricsSummary(),
            alerts: await this.getAlertsSummary(),
            uptime: process.uptime()
        };

        return report;
    }

    /**
     * Período do relatório (últimas 24h)
     */
    getReportPeriod() {
        const end = new Date();
        const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        return {
            start: start.toISOString(),
            end: end.toISOString(),
            label: `${start.toLocaleDateString('pt-BR')} - ${end.toLocaleDateString('pt-BR')}`
        };
    }

    /**
     * Status das sessões do banco
     */
    async getSessionsStatus() {
        try {
            const { Device } = require('../Models');
            
            const allDevices = await Device.findAll({
                attributes: ['session', 'status', 'attempts_start', 'last_start', 'updated_at']
            });

            const connected = allDevices.filter(d => d.status === 'CONNECTED' || d.status === 'isLogged').length;
            const disconnected = allDevices.filter(d => d.status === 'DISCONNECTED' || d.status === 'desconnectedMobile').length;
            const qrCode = allDevices.filter(d => d.status === 'qrCode' || d.status === 'notLogged').length;
            const error = allDevices.filter(d => d.status === 'error' || d.status === 'browserClose').length;

            // Sessões problemáticas (muitas tentativas)
            const problematic = allDevices.filter(d => d.attempts_start >= 3);

            return {
                total: allDevices.length,
                connected,
                disconnected,
                qrCode,
                error,
                problematic: problematic.map(d => ({
                    session: d.session,
                    attempts: d.attempts_start,
                    lastAttempt: d.last_start
                })),
                details: allDevices.map(d => ({
                    session: d.session,
                    status: d.status,
                    attempts: d.attempts_start || 0
                }))
            };
        } catch (error) {
            customLogger.error('[DAILY REPORT] Erro ao buscar sessões:', error.message);
            return { total: 0, connected: 0, disconnected: 0, qrCode: 0, error: 0, problematic: [] };
        }
    }

    /**
     * Status de memória atual
     */
    getMemoryStatus() {
        const used = process.memoryUsage();
        const os = require('os');
        
        return {
            heap: {
                used: Math.round(used.heapUsed / 1024 / 1024),
                total: Math.round(used.heapTotal / 1024 / 1024),
                percent: Math.round((used.heapUsed / used.heapTotal) * 100)
            },
            rss: Math.round(used.rss / 1024 / 1024),
            system: {
                total: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100,
                free: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100,
                usedPercent: Math.round((1 - os.freemem() / os.totalmem()) * 100)
            }
        };
    }

    /**
     * Resumo das métricas das últimas 24h
     */
    async getMetricsSummary() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const metricsFile = path.join(METRICS_DIR, `metrics_${today}.json`);

            if (!fs.existsSync(metricsFile)) {
                return { available: false, message: 'Nenhuma métrica disponível para hoje' };
            }

            const data = JSON.parse(fs.readFileSync(metricsFile, 'utf8'));
            
            if (!data.metrics || data.metrics.length === 0) {
                return { available: false, message: 'Arquivo de métricas vazio' };
            }

            // Calcular médias
            const metrics = data.metrics;
            const avgHeap = Math.round(metrics.reduce((acc, m) => acc + (m.memory?.heapUsedMB || 0), 0) / metrics.length);
            const avgRss = Math.round(metrics.reduce((acc, m) => acc + (m.memory?.rssMB || 0), 0) / metrics.length);
            const maxHeap = Math.round(Math.max(...metrics.map(m => m.memory?.heapUsedMB || 0)));
            const maxRss = Math.round(Math.max(...metrics.map(m => m.memory?.rssMB || 0)));

            // Contagem de sessões ao longo do dia
            const lastMetric = metrics[metrics.length - 1];

            return {
                available: true,
                dataPoints: metrics.length,
                memory: {
                    avgHeap,
                    avgRss,
                    maxHeap,
                    maxRss
                },
                lastSnapshot: {
                    timestamp: lastMetric.timestamp,
                    totalInstances: lastMetric.instances?.total || 0,
                    connected: lastMetric.instances?.connected || 0,
                    diskUsage: lastMetric.disk?.totalMB || 0
                }
            };
        } catch (error) {
            customLogger.error('[DAILY REPORT] Erro ao ler métricas:', error.message);
            return { available: false, message: error.message };
        }
    }

    /**
     * Resumo de alertas enviados
     */
    async getAlertsSummary() {
        const stats = emailService.getAlertStats();
        return {
            totalTypes: Object.keys(stats).length,
            details: stats
        };
    }

    /**
     * Formata o conteúdo do email em HTML (versão simplificada para compatibilidade)
     */
    formatEmailContent(report) {
        const { sessions, memory, metrics, alerts, uptime } = report;

        // Formatar uptime
        const formatUptime = (seconds) => {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            return `${days}d ${hours}h ${mins}m`;
        };

        // Status texto com badges HTML
        const getStatusText = (status) => {
            const map = {
                'CONNECTED': '<span class="status-badge badge-ok">&#x2705; Conectado</span>',
                'isLogged': '<span class="status-badge badge-ok">&#x2705; Conectado</span>',
                'DISCONNECTED': '<span class="status-badge badge-error">&#x274C; Desconectado</span>',
                'desconnectedMobile': '<span class="status-badge badge-error">&#x274C; Desconectado</span>',
                'qrCode': '<span class="status-badge badge-warning">&#x23F3; Aguardando QR</span>',
                'notLogged': '<span class="status-badge badge-warning">&#x23F3; Aguardando QR</span>',
                'error': '<span class="status-badge badge-error">&#x26A0; Erro</span>',
                'browserClose': '<span class="status-badge badge-error">&#x26A0; Erro</span>'
            };
            return map[status] || '<span class="status-badge">[-] ' + (status || 'N/A') + '</span>';
        };

        // Lista de sessões
        let sessionsText = '';
        if (sessions.details && sessions.details.length > 0) {
            sessionsText = sessions.details.map(s => 
                `<tr><td>${s.session}</td><td>${getStatusText(s.status)}</td><td>${s.attempts}</td></tr>`
            ).join('');
        }

        // Sessões problemáticas
        let problematicText = '';
        if (sessions.problematic && sessions.problematic.length > 0) {
            problematicText = `
                <h3>[ATENCAO] Sessoes Problematicas (${sessions.problematic.length})</h3>
                <p>As seguintes sessoes atingiram o limite de tentativas:</p>
                <ul>
                    ${sessions.problematic.map(s => `<li><b>${s.session}</b> - ${s.attempts} tentativas</li>`).join('')}
                </ul>
                <hr>
            `;
        }

        // Métricas
        let metricsText = '';
        if (metrics.available) {
            metricsText = `
                <h3>Metricas do Dia</h3>
                <table border="1" cellpadding="8" cellspacing="0">
                    <tr><td><b>Pontos coletados</b></td><td>${metrics.dataPoints}</td></tr>
                    <tr><td><b>Heap medio</b></td><td>${metrics.memory.avgHeap}MB (max: ${metrics.memory.maxHeap}MB)</td></tr>
                    <tr><td><b>RSS medio</b></td><td>${metrics.memory.avgRss}MB (max: ${metrics.memory.maxRss}MB)</td></tr>
                    <tr><td><b>Uso de disco</b></td><td>${metrics.lastSnapshot.diskUsage}MB</td></tr>
                </table>
                <br>
            `;
        }

        // Alertas
        let alertsText = '';
        if (Object.keys(alerts.details).length > 0) {
            alertsText = `
                <h3>Alertas Enviados</h3>
                <ul>
                    ${Object.entries(alerts.details).map(([type, info]) => 
                        `<li><b>${type}:</b> ${info.count}x</li>`
                    ).join('')}
                </ul>
            `;
        }

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; }
        .container { max-width: 800px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #25D366; }
        .header h1 { color: #25D366; margin: 0; font-size: 28px; }
        .header .date { color: #666; font-size: 14px; margin-top: 5px; }
        .header .logo { font-size: 48px; margin-bottom: 10px; }
        h2 { color: #333; margin-top: 30px; padding: 10px 15px; background: linear-gradient(90deg, #25D366 0%, #128C7E 100%); color: white; border-radius: 8px; font-size: 18px; }
        h3 { color: #555; margin-top: 25px; font-size: 16px; border-left: 4px solid #25D366; padding-left: 10px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        th { background: linear-gradient(90deg, #25D366 0%, #128C7E 100%); color: white; padding: 12px 15px; text-align: left; font-weight: 600; }
        td { padding: 12px 15px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background: #f8f9fa; }
        tr:hover { background: #e8f5e9; }
        .stat-card { display: inline-block; width: 23%; text-align: center; padding: 15px; margin: 5px; background: #f8f9fa; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .stat-card .number { font-size: 32px; font-weight: bold; }
        .stat-card .label { font-size: 12px; color: #666; margin-top: 5px; }
        .stat-ok { border-left: 4px solid #28a745; }
        .stat-ok .number { color: #28a745; }
        .stat-error { border-left: 4px solid #dc3545; }
        .stat-error .number { color: #dc3545; }
        .stat-warning { border-left: 4px solid #ffc107; }
        .stat-warning .number { color: #856404; }
        .stat-info { border-left: 4px solid #17a2b8; }
        .stat-info .number { color: #17a2b8; }
        .ok { color: #28a745; font-weight: bold; }
        .warning { color: #856404; font-weight: bold; }
        .error { color: #dc3545; font-weight: bold; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .badge-ok { background: #d4edda; color: #155724; }
        .badge-error { background: #f8d7da; color: #721c24; }
        .badge-warning { background: #fff3cd; color: #856404; }
        .footer { margin-top: 30px; padding: 20px; background: linear-gradient(90deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; text-align: center; }
        .footer p { margin: 5px 0; color: #666; font-size: 12px; }
        .emoji { font-size: 20px; vertical-align: middle; margin-right: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">&#x1F4F1;</div>
            <h1>Relatorio Diario MyZap</h1>
            <div class="date">&#x1F4C5; ${new Date().toLocaleDateString('pt-BR')} - ${new Date().toLocaleTimeString('pt-BR')}</div>
        </div>
        
        <h2>&#x1F4CA; Resumo das Sessoes</h2>
        <div style="text-align: center; margin: 20px 0;">
            <div class="stat-card stat-ok">
                <div class="number">${sessions.connected}</div>
                <div class="label">&#x2705; Conectadas</div>
            </div>
            <div class="stat-card stat-error">
                <div class="number">${sessions.disconnected + sessions.error}</div>
                <div class="label">&#x274C; Desconectadas</div>
            </div>
            <div class="stat-card stat-warning">
                <div class="number">${sessions.qrCode}</div>
                <div class="label">&#x23F3; Aguardando QR</div>
            </div>
            <div class="stat-card stat-info">
                <div class="number">${sessions.total}</div>
                <div class="label">&#x1F4F1; Total</div>
            </div>
        </div>

        ${problematicText}

        <h3>&#x1F4BE; Uso de Memoria</h3>
        <table>
            <tr><td><b>&#x1F9E0; Heap</b></td><td>${memory.heap.used}MB / ${memory.heap.total}MB (${memory.heap.percent}%)</td></tr>
            <tr><td><b>&#x1F4BB; RSS</b></td><td>${memory.rss}MB</td></tr>
            <tr><td><b>&#x1F5A5; Sistema</b></td><td>${memory.system.usedPercent}% usado (${memory.system.free}GB livre)</td></tr>
            <tr><td><b>&#x23F1; Uptime</b></td><td>${formatUptime(uptime)}</td></tr>
        </table>

        ${metricsText}

        <h3>&#x1F4F1; Detalhes das Sessoes</h3>
        <table>
            <tr><th>Sessao</th><th>Status</th><th>Tentativas</th></tr>
            ${sessionsText || '<tr><td colspan="3">Nenhuma sessao cadastrada</td></tr>'}
        </table>

        ${alertsText}

        <div class="footer">
            <p>&#x1F916; Relatorio gerado automaticamente pelo <b>MyZap API</b></p>
            <p>&#x1F4E7; Voce recebeu este email porque esta cadastrado para receber relatorios do sistema.</p>
            <p style="margin-top: 10px; font-size: 11px; color: #999;">MyZap - Automacao WhatsApp Profissional</p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Força envio do relatório (para testes)
     */
    async sendNow() {
        return await this.sendDailyReport();
    }

    /**
     * Retorna status do job
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            lastReportSent: this.lastReportSent,
            nextRun: `${String(REPORT_HOUR).padStart(2, '0')}:${String(REPORT_MINUTE).padStart(2, '0')}`,
            timezone: 'America/Sao_Paulo'
        };
    }
}

// Exportar instância singleton
const dailyReportJob = new DailyReportJob();

module.exports = dailyReportJob;
