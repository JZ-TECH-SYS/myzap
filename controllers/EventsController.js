'use strict';

const moment = require('moment');
const webhooks = require('./WebhooksController.js');
const customLogger = require('../util/customLogger.js'); // ✅ Logger padronizado
const config = require('../config.js');

const DeviceModel = require('../Models/device.js');
const Device = DeviceModel(config.sequelize);
const DeviceCompanyModel = require('../Models/deviceCompany.js');
const DeviceCompany = DeviceCompanyModel(config.sequelize);
const ChatHistoryHelper = require('./helper/chatHistory.js');

/* -------- helpers internos -------- */
const eventsHelper = require('./helper/events.js');
const TriggersHelper = require('./helper/triggers.js');
const EmpresaIA = require('./helper/empresaIA.js');
const transcribe = require('./helper/audioTranscriber.js');

moment.locale('pt-br');

module.exports = class Events {
  /**
   * Orquestra o recebimento de qualquer mensagem
   * – socket / webhook
   * – IA (somente privado + empresa habilitada)
   */
  static async receiveMessage(session, client, req) {
    // ✅ COMPATIBILIDADE - Detectar tipo de engine
    if (typeof client?.onAnyMessage === 'function') {
      // 🔸 WPPConnect & Venom - usam método onAnyMessage
      client.onAnyMessage(async message => {
        await this.processMessage(message, session, client, req);
      });
    } else if (typeof client?.on === 'function') {
      // 🔸 WhatsApp Web.js - usa eventos
      client.on('message', async (message) => {
        await this.processMessage(message, session, client, req);
      });
    }
  }

  static async processMessage(message, session, client, req) {
    async function responseDefault(payload) {
      await webhooks?.wh_messages(session, payload);
      // ✅ VERIFICAR SE funcoesSocket EXISTE E TEM O MÉTODO
      if (req.funcoesSocket && typeof req.funcoesSocket.events === 'function') {
        req.funcoesSocket.events(session, message);
      } else {
        customLogger.info(`⚠️ [${session}] funcoesSocket.events não disponível`);
      }
    }

    const { funcoesSocket } = req;
    const sessionkey = req.headers?.sessionkey;
    const numero = message.from;

    /* 1. ignora tipos não permitidos */
    if (!eventsHelper.isPermitido(message)) {
      return funcoesSocket.events(session, message);
    }

    /* 2. monta payload padrão */
    const payload = await eventsHelper.montarPayload(message, session, client);

   
    /* 3. mensagens enviadas pelo próprio bot ou vc*/
    if (message.fromMe) {
      if (funcoesSocket && typeof funcoesSocket.messagesent === 'function') {
        funcoesSocket.messagesent(session, payload);
      }
      await webhooks?.wh_messages(session, payload);

      const outboundText = typeof message.body === 'string' ? message.body.trim() : '';
      const isEcho = await ChatHistoryHelper.isRecentAssistantEcho({
        session,
        sessionkey,
        numero,
        text: outboundText,
      });

      if (!isEcho && outboundText) {
        await ChatHistoryHelper.registerAgentMessage({ session, sessionkey, numero, text: outboundText });
        customLogger.info(`${LOG_PREFIX} Agent reply detected`, { session, numero });
      }

      return;
    }
   
    funcoesSocket.message(session, payload);
    /* 4. processa IA (se habilitado e não for grupo) */
    /* ----- IA somente se privado e empresa habilitada ----- */
    const empresa = await this.verificarIAHabilitada(session, sessionkey);
    if (!empresa || message.isGroupMsg) {
      await responseDefault(payload);
      return;
    }

    /* ----- Áudio / ptt ----- */
    if (message.type === 'audio' || message.type === 'ptt') {
      await client.sendText(
        numero,
        'Recebi seu áudio. Só um instante enquanto o escuto, já te respondo! 😊🚀'
      );
      if (message.duration && message.duration > 90) {
        await client.sendText(
          numero,
          'Recebemos seu áudio, mas ele passa de 1 min 30 s. Pode enviar um resumo rapidinho? 😊'
        );
        await responseDefault(payload);
        return;
      }

      const mediaBuffer = await client.decryptFile(message);
      const MAX_SIZE = 25 * 1024 * 1024;
      if (mediaBuffer.byteLength > MAX_SIZE) {
        await client.sendText(numero, 'O áudio ficou grande demais. Poderia enviar algo mais curto? 😉');
        await responseDefault(payload);
        return;
      }

      try {
        const textoTranscrito = await transcribe({ buffer: mediaBuffer, session, sessionkey });
        if (!textoTranscrito) throw new Error('transcrição vazia');


        message.body = textoTranscrito;
        message.type = 'chat';
        payload.body = textoTranscrito;
        payload.type = 'chat';
      } catch (err) {
        console.error(`[IA] Erro ao transcrever áudio: ${err.message}`);
        await client.sendText(numero, 'Desculpe, não consegui entender o áudio. Pode digitar? 🤔');
        await responseDefault(payload);
        return;
      }
    }

    const plainBody = typeof message.body === 'string' ? message.body.trim() : '';
    if (plainBody) {
      await ChatHistoryHelper.registerUserMessage({ session, sessionkey, numero, text: plainBody });
    }

    const iaAtiva = empresa.ia_ativa !== false;
    const mensagemPadrao = typeof empresa.mensagem_padrao === 'string' ? empresa.mensagem_padrao.trim() : '';
    const cooldownPadrao = Number.isInteger(empresa.tempo_mensagem_padrao) ? empresa.tempo_mensagem_padrao : 0;

    const enviarMensagemPadrao = async (motivo) => {
      if (!mensagemPadrao) {
        return false;
      }

      const jaEnviouHoje = await ChatHistoryHelper.jaEnvieiMensagemPadraoHoje({ session, sessionkey, numero });
      if (jaEnviouHoje) {
        return false;
      }

      const dentroDoCooldown = await ChatHistoryHelper.dentroDoCooldownPadrao({
        session,
        sessionkey,
        numero,
        minutos: cooldownPadrao,
      });
      if (dentroDoCooldown) {
        return false;
      }

      await client.sendText(numero, mensagemPadrao);
      await ChatHistoryHelper.registerAssistantMessage({
        session,
        sessionkey,
        numero,
        text: mensagemPadrao,
        messageType: 'mensagem_padrao',
      });
      customLogger.info(`${LOG_PREFIX} Mensagem padrao enviada`, { session, numero, motivo });
      return true;
    };

    if (!iaAtiva) {
      await enviarMensagemPadrao('ia_desligada');
      await responseDefault(payload);
      return;
    }

    const humanoFalou = await ChatHistoryHelper.humanoFalouRecentemente({
      session,
      sessionkey,
      numero,
      minutos: HUMAN_PAUSE_MINUTES,
    });
    if (humanoFalou) {
      await enviarMensagemPadrao('agente_recente');
      await responseDefault(payload);
      return;
    }

    const iaEmCooldown = await ChatHistoryHelper.emCooldownDeIA({
      session,
      sessionkey,
      numero,
      segundos: IA_COOLDOWN_SECONDS,
    });
    if (iaEmCooldown) {
      await enviarMensagemPadrao('ia_em_cooldown');
      await responseDefault(payload);
      return;
    }

    const gatilhoIA = TriggersHelper.necessitaIA(plainBody);
    if (!gatilhoIA) {
      await enviarMensagemPadrao('gatilho_nao_acionado');
      await responseDefault(payload);
      return;
    }

    try {
      const respostaIA = await EmpresaIA.processarMensagem({
        session,
        sessionkey,
        message,
        idprompt: empresa.idprompt || null,
        vetor: empresa.vector_name || null,
      });

      if (respostaIA) {
        await client.sendText(numero, respostaIA);
        await ChatHistoryHelper.registerAssistantMessage({
          session,
          sessionkey,
          numero,
          text: respostaIA,
          messageType: 'ia',
        });
        customLogger.info(`${LOG_PREFIX} Resposta IA enviada`, { session, numero });
      } else {
        await enviarMensagemPadrao('ia_sem_resposta');
      }
    } catch (error) {
      customLogger.error(`${LOG_PREFIX} Erro ao processar IA`, error?.message || error);
      await enviarMensagemPadrao('erro_ia');
    }


    /* 5. webhook + evento genérico */
    await responseDefault(payload);
  }

  /**
   * Verifica se o device atual pertence a empresa habilitada para IA.
   */
  static async verificarIAHabilitada(session, sessionkey) {
    return await DeviceCompany.findOne({ where: { session, sessionkey } });
  }

  static statusMessage(session, client, req) {
    // ✅ COMPATIBILIDADE - Detectar tipo de engine pela presença de métodos
    if (typeof client?.onAck === 'function') {
      // 🔸 WPPConnect & Venom - usam método onAck
      client.onAck(async ack => {
        const type = eventsHelper.normalizarTipo(ack);
        const status = eventsHelper.tipoAckToStatus(ack?.ack);

        const response = {
          wook: 'MESSAGE_STATUS',
          status,
          type,
          id: ack?.id?._serialized,
          from: ack?.from?.split('@')[0],
          to: ack?.to?.split('@')[0],
          session,
          dateTime: eventsHelper.formatarData(ack?.t),
          data: ack
        };

        req.funcoesSocket.ack(session, response);
        await webhooks?.wh_messages(session, response);
      });
    } else if (typeof client?.on === 'function') {
      // 🔸 WhatsApp Web.js - usa eventos
      client.on('message_ack', async (msg, ack) => {
        try {
          // ✅ VERIFICAÇÕES DE SEGURANÇA
          if (!msg) {
            customLogger.info(`⚠️ [${session}] message_ack: msg é undefined`);
            return;
          }

          const type = eventsHelper.normalizarTipo(msg);
          const status = eventsHelper.tipoAckToStatus(ack);

          const response = {
            wook: 'MESSAGE_STATUS',
            status,
            type,
            id: msg?.id?._serialized || msg?.id,
            from: msg?.from?.split('@')[0] || 'unknown',
            to: msg?.to?.split('@')[0] || 'unknown',
            session,
            dateTime: eventsHelper.formatarData(msg?.timestamp),
            data: { msg, ack }
          };

          // ✅ VERIFICAR SE funcoesSocket EXISTE E TEM O MÉTODO
          if (req.funcoesSocket && typeof req.funcoesSocket.ack === 'function') {
            req.funcoesSocket.ack(session, response);
          } else {
            customLogger.info(`⚠️ [${session}] funcoesSocket.ack não disponível`);
          }
          
          await webhooks?.wh_messages(session, response);
        } catch (error) {
          customLogger.info(`❌ [${session}] Erro no message_ack: ${error.message}`);
        }
      });
    }
  }

  // ✅ ADICIONADO - Método StatusMessage que estava sendo chamado
  static StatusMessage(req, status, session) {
    customLogger.info(`[STATUS MESSAGE] ${session}: ${status}`);
    // Emitir evento de status via Socket.IO
    req.io.emit('whatsapp-status', { session, status });
  }

  static async statusConnection(session, client, req) {
    // ✅ COMPATIBILIDADE - Detectar tipo de engine
    if (typeof client?.onStateChange === 'function') {
      // 🔸 WPPConnect & Venom - usam método onStateChange
      client.onStateChange(async (state) => {
        await this.processStateChange(state, session, client, req);
      });
    } else if (typeof client?.on === 'function') {
      // 🔸 WhatsApp Web.js - usa eventos
      client.on('change_state', async (state) => {
        await this.processStateChange(state, session, client, req);
      });
    }
  }

  static async processStateChange(state, session, client, req) {
    customLogger.info('State changed', state);
    await Device.update(
      { state, updated_at: moment().format('YYYY-MM-DD HH:mm:ss') },
      { where: { session } }
    );

    if (state === 'OPENING') customLogger.info(`[SESSION] ${session} - Abrindo navegador.`);
    if (state === 'PAIRING') customLogger.info(`[SESSION] ${session} - Lendo o QRCode.`);
    if (state === 'CONFLICT') {
      client?.useHere();
      customLogger.info(`[SESSION] ${session} - Conflito de login.`);
    }
    if (state === 'UNPAIRED') {
      await Device.destroy({ where: { session } });
    }
    if (state === 'TIMEOUT') {
      client?.startPhoneWatchdog(15000);
      client?.stopPhoneWatchdog(15000);
    }
  }
};






