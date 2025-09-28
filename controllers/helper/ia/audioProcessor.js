const customLogger = require('../../../util/customLogger');
const transcribe = require('../events/audioTranscriber');
const MessageSender = require('../events/messageSender');
const MediaDecryptor = require('../events/mediaDecryptor');
const { ACEITAR_AUDIO, MAX_AUDIO_SIZE, MAX_AUDIO_DURATION } = require('./iaConfig');

/**
 * Processa mensagens de áudio: validações, transcrição e conversão para texto.
 * IMPORTANTE: Só processa áudio se IA estiver ativa (ela faz a transcrição)
 * Retorna: { success: boolean, message?, payload?, skipAudio?: boolean }
 */
async function processAudio({ message, client, numero, payload, session, sessionkey, empresa }) {
    // 🚫 Se IA não estiver ativa, rejeitar áudio (não há quem transcreva)
    const iaAtiva = empresa?.ia_ativa !== false;
    if (!iaAtiva) {
        return { success: true, skipAudio: true };
    }

    if (message.type !== 'audio' && message.type !== 'ptt') {
        return { success: true }; // não é áudio, continua processamento normal
    }

    // ✅ Verificação global de áudio habilitado
    if (!ACEITAR_AUDIO) {
        await MessageSender.sendText({
            client,
            to: numero,
            text: 'Desculpe, não estou processando áudios no momento. Pode digitar sua mensagem? 😊'
        });
        return { success: false, skipAudio: true };
    }

    await MessageSender.sendText({
        client,
        to: numero,
        text: 'Recebi seu áudio. Só um instante enquanto o escuto, já te respondo! 😊🚀'
    });

    if (message.duration && message.duration > MAX_AUDIO_DURATION) {
        await MessageSender.sendText({
            client,
            to: numero,
            text: `Recebemos seu áudio, mas ele passa de ${MAX_AUDIO_DURATION}s. Pode enviar um resumo rapidinho? 😊`
        });
        return { success: false };
    }

    try {
        const mediaBuffer = await MediaDecryptor.decryptFile({ client, message });
        if (mediaBuffer.byteLength > MAX_AUDIO_SIZE) {
            await MessageSender.sendText({
                client,
                to: numero,
                text: 'O áudio ficou grande demais. Poderia enviar algo mais curto? 😉'
            });
            return { success: false };
        }

        const textoTranscrito = await transcribe({ buffer: mediaBuffer, session, sessionkey });
        if (!textoTranscrito) throw new Error('transcrição vazia');

        // Atualizar message e payload com texto transcrito
        message.body = textoTranscrito;
        message.type = 'chat';
        payload.body = textoTranscrito;
        payload.type = 'chat';

        return { success: true, message, payload };
    } catch (err) {
        customLogger.error(`[IA] Erro ao transcrever áudio: ${err.message}`);
        await MessageSender.sendText({
            client,
            to: numero,
            text: 'Desculpe, não consegui entender o áudio. Pode digitar? 🤔'
        });
        return { success: false };
    }
}

module.exports = { processAudio };
