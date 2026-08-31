const customLogger = require('../../../util/customLogger');

/**
 * Cliente do Agente IA do ClickExpress (serviço no GKE).
 *
 * Ativado por IA_PROVIDER=agente. O myzap vira só transporte: entrega a
 * mensagem (texto ou áudio base64) e envia de volta o que o agente responder.
 * Guards, memória, LLM (Gemini/Vertex) e tools do MCP vivem no agente —
 * este arquivo não decide nada.
 *
 * Env:
 *   AGENT_URL        ex.: https://agente-clickexpress.jztech.com.br
 *   AGENT_AUTH_TOKEN o mesmo AGENT_AUTH_TOKEN do serviço
 */
const AGENT_URL = (process.env.AGENT_URL || '').replace(/\/+$/, '');
const AGENT_AUTH_TOKEN = process.env.AGENT_AUTH_TOKEN || '';

async function atender({ sessionkey, numero, nome, texto, audioBase64, audioMime, origem }) {
    if (!AGENT_URL) {
        customLogger.error('[AGENTE] AGENT_URL não configurada com IA_PROVIDER=agente');
        return null;
    }

    const corpo = {
        sessionkey,
        numero: String(numero || '').replace(/@.*$/, ''), // tira @c.us
        nome: nome || null,
        origem: origem || 'cliente',
    };
    if (texto) corpo.texto = texto;
    if (audioBase64) {
        corpo.audio_base64 = audioBase64;
        corpo.audio_mime = audioMime || 'audio/ogg';
    }

    try {
        const resp = await fetch(`${AGENT_URL}/atender`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(AGENT_AUTH_TOKEN ? { Authorization: `Bearer ${AGENT_AUTH_TOKEN}` } : {}),
            },
            body: JSON.stringify(corpo),
            signal: AbortSignal.timeout(120000),
        });

        if (!resp.ok) {
            customLogger.error(`[AGENTE] HTTP ${resp.status} do agente`);
            return null;
        }

        const dados = await resp.json();
        if (dados.silencio) {
            customLogger.debug(`[AGENTE] silêncio (${dados.motivo || 's/ motivo'})`);
            return null;
        }
        return dados.resposta || null;
    } catch (err) {
        customLogger.error(`[AGENTE] erro na chamada: ${err.message}`);
        return null;
    }
}

module.exports = { atender };
