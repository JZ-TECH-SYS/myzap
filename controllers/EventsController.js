'use strict';

const moment = require('moment');
const webhooks = require('./WebhooksController.js');
const logger = require('../util/logger.js');
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
    client?.onAnyMessage(async message => {

      async function responseDefault(payload) {
        await webhooks?.wh_messages(session, payload);
        funcoesSocket.events(session, message);
      }

      const { funcoesSocket } = req;
      const sessionkey = req.headers?.sessionkey;
      const texto = (message.body || '').trim();
      const numero = message.from;

      /* 1. ignora tipos não permitidos */
      if (!eventsHelper.isPermitido(message)) {
        return funcoesSocket.events(session, message);
      }

      /* 2. monta payload padrão */
      const payload = await eventsHelper.montarPayload(message, session, client);

      /* 3. mensagens enviadas pelo próprio bot ou vc*/
      if (message.fromMe) {
        funcoesSocket.messagesent(session, payload);
        await webhooks?.wh_messages(session, payload);   // ⬅️ um único disparo
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

          // grava no histórico ANTES de mudar o type
          await ChatHistoryHelper.savePair({
            session,
            sessionkey,
            numero,
            userText: textoTranscrito,
            assistantText: null
          });

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

      const ativa = await ChatHistoryHelper.hasRecent({
        session, sessionkey, numero, minutos: 30
      });


      if (ativa) {
        /* já tem diálogo recente → chama IA direto (sem triggers) */
        const resposta = await EmpresaIA.processarMensagem(
          { session, sessionkey, message },
          { skipTriggers: true }
        );
        if (resposta) await client.sendText(numero, resposta);

      } else if (TriggersHelper.necessitaIA(texto)) {
        const resposta = await EmpresaIA.processarMensagem({ session, sessionkey, message });
        if (resposta) await client.sendText(numero, resposta);

      } else if (empresa.mensagem_padrao) {
        await client.sendText(numero, empresa.mensagem_padrao);
        await ChatHistoryHelper.savePair({
          session,
          sessionkey,
          numero,
          userText: null,
          assistantText: empresa.mensagem_padrao   // grava saudação
        });
      }


      /* 5. webhook + evento genérico */
      await responseDefault();
    });
  }

  /**
   * Verifica se o device atual pertence a empresa habilitada para IA.
   */
  static async verificarIAHabilitada(session, sessionkey) {
    return await DeviceCompany.findOne({ where: { session, sessionkey } });
  }

  static statusMessage(session, client, req) {
    client?.onAck(async ack => {
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
        dateTime: events.formatarData(ack?.t),
        data: ack
      };

      req.funcoesSocket.ack(session, response);
      await webhooks?.wh_messages(session, response);
    });
  }

  static async statusConnection(session, client, req) {
    client?.onStateChange(async (state) => {
      console.log('State changed', state);
      await Device.update(
        { state, updated_at: moment().format('YYYY-MM-DD HH:mm:ss') },
        { where: { session } }
      );

      if (state === 'OPENING') logger.info(`[SESSION] ${session} - Abrindo navegador.`);
      if (state === 'PAIRING') logger.info(`[SESSION] ${session} - Lendo o QRCode.`);
      if (state === 'CONFLICT') {
        client?.useHere();
        logger.info(`[SESSION] ${session} - Conflito de login.`);
      }
      if (state === 'UNPAIRED') {
        await Device.destroy({ where: { session } });
      }
      if (state === 'TIMEOUT') {
        client?.startPhoneWatchdog(15000);
        client?.stopPhoneWatchdog(15000);
      }
    });
  }
};
