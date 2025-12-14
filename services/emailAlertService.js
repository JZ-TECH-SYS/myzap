/**
 * 📧 Serviço de Alertas por Email
 * 
 * Integração com a API MailJZTech para envio de alertas do sistema
 * API: https://api-mail.jztech.com.br/public/
 * 
 * Eventos suportados:
 * - HEAP_CRITICAL: Heap > 90%
 * - MEMORY_CRITICAL: Memória do sistema > 85%
 * - SESSION_TIMEOUT: Timeout de sessão
 * - PM2_RESTART: PM2 restart detectado
 * - UNHANDLED_REJECTION: Erro não tratado
 * - SESSION_DISCONNECTED: Sessão desconectada
 * - SYSTEM_ERROR: Erro genérico do sistema
 * 
 * @author JZ-TECH
 * @date 2025-12-14
 */

const axios = require('axios');
const customLogger = require('../util/customLogger');

class EmailAlertService {
    constructor() {
        this.apiUrl = process.env.EMAIL_SERVICE || 'https://api-mail.jztech.com.br/public/';
        this.apiToken = process.env.EMAIL_TOKEN || '';
        this.destinatario = process.env.EMAIL_DESTINATION || '';
        this.cc = process.env.EMAIL_CC || '';
        this.nomeRemetente = process.env.EMAIL_SENDER_NAME || 'MyZap Monitor';
        this.timeout = 30000; // 30 segundos
        this.lastError = null;
        this.lastResponse = null;
        
        // ✅ Controle de rate limiting para evitar flood de emails
        this.alertHistory = new Map(); // tipo => { count, lastSent }
        this.rateLimitMinutes = 15; // Mínimo de 15 minutos entre alertas do mesmo tipo
        this.maxAlertsPerHour = 4; // Máximo de 4 alertas do mesmo tipo por hora
        
        // ✅ Cache de status do serviço
        this.isConfigured = this._checkConfiguration();
    }

    /**
     * Verifica se o serviço está configurado corretamente
     */
    _checkConfiguration() {
        if (!this.apiToken) {
            customLogger.warning('[EMAIL ALERT] Token da API de email não configurado (EMAIL_TOKEN)');
            return false;
        }
        if (!this.destinatario) {
            customLogger.warning('[EMAIL ALERT] Destinatário não configurado (EMAIL_DESTINATION)');
            return false;
        }
        customLogger.success('[EMAIL ALERT] Serviço de alertas por email configurado ✅');
        return true;
    }

    /**
     * Verifica rate limiting antes de enviar
     * @param {string} alertType - Tipo do alerta
     * @returns {boolean} - true se pode enviar, false se bloqueado
     */
    _canSendAlert(alertType) {
        const now = Date.now();
        const history = this.alertHistory.get(alertType);
        
        if (!history) {
            return true;
        }
        
        const minutesSinceLastSent = (now - history.lastSent) / (1000 * 60);
        
        // Bloquear se enviado há menos de rateLimitMinutes
        if (minutesSinceLastSent < this.rateLimitMinutes) {
            customLogger.info(`[EMAIL ALERT] Rate limit: ${alertType} bloqueado (último há ${minutesSinceLastSent.toFixed(1)} min)`);
            return false;
        }
        
        // Resetar contador se passou 1 hora
        if (minutesSinceLastSent >= 60) {
            this.alertHistory.set(alertType, { count: 0, lastSent: now });
            return true;
        }
        
        // Bloquear se excedeu limite por hora
        if (history.count >= this.maxAlertsPerHour) {
            customLogger.info(`[EMAIL ALERT] Rate limit: ${alertType} excedeu ${this.maxAlertsPerHour}/hora`);
            return false;
        }
        
        return true;
    }

    /**
     * Registra que um alerta foi enviado
     * @param {string} alertType - Tipo do alerta
     */
    _recordAlertSent(alertType) {
        const now = Date.now();
        const history = this.alertHistory.get(alertType) || { count: 0, lastSent: 0 };
        
        // Se passou 1 hora, resetar contador
        if ((now - history.lastSent) >= 60 * 60 * 1000) {
            this.alertHistory.set(alertType, { count: 1, lastSent: now });
        } else {
            this.alertHistory.set(alertType, { 
                count: history.count + 1, 
                lastSent: now 
            });
        }
    }

    /**
     * Envia alerta por email
     * @param {string} alertType - Tipo do alerta (HEAP_CRITICAL, SESSION_TIMEOUT, etc.)
     * @param {object} data - Dados adicionais do alerta
     * @returns {Promise<object>} - Resultado do envio
     */
    async send(alertType, data = {}) {
        // Verificar configuração
        if (!this.isConfigured) {
            customLogger.warning(`[EMAIL ALERT] Serviço não configurado, alerta ${alertType} ignorado`);
            return { success: false, reason: 'not_configured' };
        }
        
        // Verificar rate limiting
        if (!this._canSendAlert(alertType)) {
            return { success: false, reason: 'rate_limited' };
        }
        
        try {
            const { assunto, corpoHtml } = this._buildAlertEmail(alertType, data);
            
            const payload = {
                destinatario: this.destinatario,
                assunto: assunto,
                corpo_html: corpoHtml,
                nome_remetente: this.nomeRemetente
            };
            
            // Adicionar CC se configurado
            if (this.cc) {
                payload.cc = this.cc;
            }
            
            const response = await this._sendRequest('sendEmail', payload);
            
            // Registrar envio no rate limiter
            this._recordAlertSent(alertType);
            
            customLogger.success(`[EMAIL ALERT] Alerta ${alertType} enviado com sucesso`);
            return { success: true, data: response };
            
        } catch (error) {
            customLogger.error(`[EMAIL ALERT] Erro ao enviar alerta ${alertType}: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Envia email simples (sem rate limiting)
     * @param {string} destinatario - Email do destinatário
     * @param {string} assunto - Assunto do email
     * @param {string} corpoHtml - Corpo do email em HTML
     * @param {object} options - Opções adicionais (cc, bcc, nomeRemetente)
     * @returns {Promise<object>} - Resultado do envio
     */
    async enviar(destinatario, assunto, corpoHtml, options = {}) {
        if (!this.apiToken) {
            throw new Error('Token da API de email não configurado');
        }
        
        const payload = {
            destinatario,
            assunto,
            corpo_html: corpoHtml
        };
        
        // Só adiciona corpo_texto se explicitamente solicitado
        if (options.corpoTexto) {
            payload.corpo_texto = options.corpoTexto;
        }
        
        if (options.cc) {
            payload.cc = Array.isArray(options.cc) ? options.cc.join(',') : options.cc;
        }
        
        if (options.bcc) {
            payload.bcc = Array.isArray(options.bcc) ? options.bcc.join(',') : options.bcc;
        }
        
        // Sempre enviar nome do remetente (usa padrão se não especificado)
        payload.nome_remetente = options.nomeRemetente || this.nomeRemetente;
        
        return this._sendRequest('sendEmail', payload);
    }

    /**
     * Converte HTML para texto puro
     * @param {string} html - Conteúdo HTML
     * @returns {string} - Texto puro
     */
    _htmlToText(html) {
        if (!html) return '';
        
        return html
            // Remover scripts e styles
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            // Converter quebras de linha
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/tr>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<\/h[1-6]>/gi, '\n\n')
            // Converter listas
            .replace(/<li[^>]*>/gi, '• ')
            // Converter tabelas (td/th)
            .replace(/<\/t[dh]>/gi, ' | ')
            // Remover todas as outras tags
            .replace(/<[^>]+>/g, '')
            // Decodificar entidades HTML comuns
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&rsquo;/gi, "'")
            .replace(/&lsquo;/gi, "'")
            .replace(/&rdquo;/gi, '"')
            .replace(/&ldquo;/gi, '"')
            .replace(/&mdash;/gi, '—')
            .replace(/&ndash;/gi, '–')
            // Limpar espaços extras
            .replace(/[ \t]+/g, ' ')
            .replace(/\n[ \t]+/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    /**
     * Constrói o email de alerta baseado no tipo
     * @param {string} alertType - Tipo do alerta
     * @param {object} data - Dados do alerta
     * @returns {object} - { assunto, corpoHtml }
     */
    _buildAlertEmail(alertType, data) {
        const hostname = require('os').hostname();
        const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        
        const alertConfigs = {
            HEAP_CRITICAL: {
                emoji: '⚠️',
                titulo: 'Heap Crítico',
                cor: '#ff9800',
                descricao: `Uso de heap do processo atingiu ${data.heapPercent?.toFixed(2) || 'N/A'}%`
            },
            MEMORY_CRITICAL: {
                emoji: '🔴',
                titulo: 'Memória Crítica',
                cor: '#f44336',
                descricao: `Uso de memória do sistema atingiu ${data.memoryPercent?.toFixed(2) || 'N/A'}%`
            },
            SESSION_TIMEOUT: {
                emoji: '⏱️',
                titulo: 'Timeout de Sessão',
                cor: '#ff5722',
                descricao: `Sessão "${data.session || 'N/A'}" não conectou após timeout`
            },
            PM2_RESTART: {
                emoji: '🔄',
                titulo: 'PM2 Restart Detectado',
                cor: '#2196f3',
                descricao: `Aplicação foi reiniciada pelo PM2`
            },
            UNHANDLED_REJECTION: {
                emoji: '💥',
                titulo: 'Erro Não Tratado',
                cor: '#f44336',
                descricao: `Erro: ${data.error || 'Desconhecido'}`
            },
            SESSION_DISCONNECTED: {
                emoji: '📴',
                titulo: 'Sessão Desconectada',
                cor: '#9c27b0',
                descricao: `Sessão "${data.session || 'N/A'}" foi desconectada`
            },
            SYSTEM_ERROR: {
                emoji: '❌',
                titulo: 'Erro do Sistema',
                cor: '#f44336',
                descricao: data.error || 'Erro desconhecido'
            },
            SESSION_CONNECTED: {
                emoji: '✅',
                titulo: 'Sessão Conectada',
                cor: '#4caf50',
                descricao: `Sessão "${data.session || 'N/A'}" conectou com sucesso`
            }
        };
        
        const config = alertConfigs[alertType] || {
            emoji: '📢',
            titulo: alertType,
            cor: '#607d8b',
            descricao: JSON.stringify(data)
        };
        
        const assunto = `${config.emoji} [MyZap] ${config.titulo} - ${hostname}`;
        
        const corpoHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: ${config.cor}; color: white; padding: 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 20px; }
        .info-box { background: #f9f9f9; border-left: 4px solid ${config.cor}; padding: 15px; margin: 15px 0; }
        .label { font-weight: bold; color: #666; }
        .value { color: #333; }
        .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 8px 0; border-bottom: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${config.emoji} ${config.titulo}</h1>
        </div>
        <div class="content">
            <div class="info-box">
                <p style="margin: 0; font-size: 16px;">${config.descricao}</p>
            </div>
            
            <table>
                <tr>
                    <td class="label">Servidor:</td>
                    <td class="value">${hostname}</td>
                </tr>
                <tr>
                    <td class="label">Data/Hora:</td>
                    <td class="value">${timestamp}</td>
                </tr>
                <tr>
                    <td class="label">Tipo de Alerta:</td>
                    <td class="value">${alertType}</td>
                </tr>
                ${data.session ? `
                <tr>
                    <td class="label">Sessão:</td>
                    <td class="value">${data.session}</td>
                </tr>
                ` : ''}
                ${data.uptime ? `
                <tr>
                    <td class="label">Uptime:</td>
                    <td class="value">${this._formatUptime(data.uptime)}</td>
                </tr>
                ` : ''}
            </table>
            
            ${Object.keys(data).length > 0 ? `
            <h3 style="margin-top: 20px;">Dados Adicionais:</h3>
            <pre style="background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px;">${JSON.stringify(data, null, 2)}</pre>
            ` : ''}
        </div>
        <div class="footer">
            <p>MyZap - Sistema de Alertas Automáticos</p>
            <p>Este é um email automático, não responda.</p>
        </div>
    </div>
</body>
</html>
        `.trim();
        
        return { assunto, corpoHtml };
    }

    /**
     * Formata uptime em formato legível
     * @param {number} seconds - Tempo em segundos
     * @returns {string} - Tempo formatado
     */
    _formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        
        return parts.join(' ') || '< 1m';
    }

    /**
     * Envia requisição para a API
     * @param {string} endpoint - Endpoint da API
     * @param {object} payload - Dados para enviar
     * @returns {Promise<object>} - Resposta da API
     */
    async _sendRequest(endpoint, payload) {
        const url = this.apiUrl.replace(/\/$/, '') + '/' + endpoint;
        
        try {
            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: this.timeout
            });
            
            this.lastResponse = response.data;
            this.lastError = null;
            
            return response.data;
            
        } catch (error) {
            this.lastError = error.message;
            
            if (error.response) {
                const errorMsg = error.response.data?.error || error.response.data?.message || 'Erro desconhecido';
                throw new Error(`API Error (${error.response.status}): ${errorMsg}`);
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('Timeout na conexão com API de email');
            } else {
                throw new Error(`Erro de conexão: ${error.message}`);
            }
        }
    }

    /**
     * Retorna o último erro
     * @returns {string|null}
     */
    getLastError() {
        return this.lastError;
    }

    /**
     * Retorna a última resposta
     * @returns {object|null}
     */
    getLastResponse() {
        return this.lastResponse;
    }

    /**
     * Retorna estatísticas de rate limiting
     * @returns {object}
     */
    getAlertStats() {
        const stats = {};
        for (const [type, history] of this.alertHistory) {
            stats[type] = {
                count: history.count,
                lastSent: new Date(history.lastSent).toISOString(),
                minutesSinceLastSent: ((Date.now() - history.lastSent) / (1000 * 60)).toFixed(1)
            };
        }
        return stats;
    }
}

// ✅ Exportar instância singleton
const emailAlertService = new EmailAlertService();

module.exports = emailAlertService;
