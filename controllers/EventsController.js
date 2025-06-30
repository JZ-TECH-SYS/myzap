'use strict';

const moment          = require('moment');
const webhooks        = require('./WebhooksController.js');
const logger          = require('../util/logger.js');
const config          = require('../config.js');

const DeviceModel          = require('../Models/device.js');
const Device               = DeviceModel(config.sequelize);
const DeviceCompanyModel   = require('../Models/deviceCompany.js');
const DeviceCompany        = DeviceCompanyModel(config.sequelize);

/* -------- helpers internos -------- */
const eventsHelper   = require('./helper/events.js');
const TriggersHelper = require('./helper/triggers.js');
const EmpresaIA      = require('./helper/empresaIA.js');

moment.locale('pt-br');

module.exports = class Events {
  /**
   * Orquestra o recebimento de qualquer mensagem
   * – socket / webhook
   * – IA (somente privado + empresa habilitada)
   */
  static async receiveMessage(session, client, req) {
    await client?.onAnyMessage(async message => {
      const { funcoesSocket } = req;
      const sessionkey       = req.headers?.sessionkey;

      /* 1. ignora tipos não permitidos */
      if (!eventsHelper.isPermitido(message)) {
        return funcoesSocket.events(session, message);
      }

      /* 2. monta payload padrão */
      const payload = await eventsHelper.montarPayload(message, session, client);

      /* 3. emite sockets */
      if (message.fromMe) {
        funcoesSocket.messagesent(session, payload);
      } else {
        funcoesSocket.message(session, payload);

        /* 4. processa IA (se habilitado e não for grupo) */
        const empresa = await this.verificarIAHabilitada(session, sessionkey);
        console.log('[EVENTS] empresa:', empresa);
        if (empresa && !message.isGroupMsg) {
          const texto = (message.body || '').trim();

          /* colocar validacao se ja conversou com esse contato n duplica msg e caso ja falou com IA continue conversa */
          if (TriggersHelper.necessitaIA(texto) ) {
            /* chama a OpenAI */
            const resposta = await EmpresaIA.processarMensagem({
              session,
              sessionkey,
              message
            });

            if (resposta) await client.sendText(message.from, resposta);
          } else if (empresa.mensagem_padrao) {
            console.log(`[IA] Nenhum trigger – enviando mensagem padrão para ${message.from}`);
            /* boas-vindas simples */
            await client.sendText(message.from, empresa.mensagem_padrao);
          }
        }
      }

      /* 5. webhook + evento genérico */
      await webhooks?.wh_messages(session, payload);
      funcoesSocket.events(session, message);
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
      const type = events.normalizarTipo(ack);
      const status = events.tipoAckToStatus(ack?.ack);

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
