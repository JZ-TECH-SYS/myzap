'use strict';

/**
 *  ┌───────────────────────────────────────────┐
 *  │  EMPRESA-IA HELPER                        │
 *  └───────────────────────────────────────────┘
 *  • Usa:
 *      – triggers.js       → decide se deve chamar IA
 *      – chatHistory.js    → ler / gravar histórico
 *      – TokenUsage model  → contabilizar tokens por mês
 */

// src/helpers/empresaIaHelper.js
'use strict';
require('dotenv').config();

const moment = require('moment');
const OpenAI = require('openai');
const config = require('../../config.js');
const Triggers = require('./triggers');
const ChatHistoryHelper = require('./chatHistory');

const TokenUsageModel = require('../../Models/tokenUsage.js');
const TokenUsage = TokenUsageModel(config.sequelize);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = {
  /**
   * Processa a mensagem recebida e responde via Prompt API.
   */
  async processarMensagem({ session, sessionkey, message, idprompt, vetor }) {
    try {
      const promptUsuario = (message?.body || '').trim();
      const numeroCliente = message?.from;

      if (!promptUsuario) return null;

      /* 1. Histórico das últimas 60 min */
      const historico = await ChatHistoryHelper.getRecent({
        session,
        sessionkey,
        numero: numeroCliente,
        minutos: 60
      });

      /* 2. Montagem do array de input (type = 'message') */
      const inputMsgs = [
        ...historico.map(h => ({
          type: 'message',
          role: h.role,          // 'user' ou 'assistant'
          content: h.msg
        })),
        { type: 'message', role: 'user', content: promptUsuario }
      ];

      /* 3. Chamada ao novo endpoint */
      const completion = await openai.responses.create({
        prompt: {
          id: idprompt,
          version: '1'
        },
        input: inputMsgs,
        tools: [
          {
            type: 'file_search',
            vector_store_ids: [vetor]
          }
        ],
        temperature: 0.9
      });
      const first = completion.output?.[0];
      // ⬇️ se o modelo pediu para criar o pedido…
      if (first?.type === 'tool' && first.name === 'criarPedido') {
        const pedido = first.arguments;

        console.log('[IA] Pedido criado:', pedido);

        await client.sendText(
          numeroCliente,
          'Pedido confirmado! Muito obrigado 😊. Se precisar de algo mais, é só chamar.'
        );
        await ChatHistoryHelper.clearHistory({ session, sessionkey, numero: numeroCliente });
        return null;         
      }

      const textoResposta = completion.output_text?.trim() || completion.output?.[0]?.content?.[0]?.text?.trim() || null;
      if (!textoResposta) return null;

      /* 4. Grava uso de tokens */
      const tokensGastos = completion.usage?.total_tokens || 0;
      const mesano = moment().format('YYYYMM');

      const [registro] = await TokenUsage.findOrCreate({
        where: { session, sessionkey, mesano },
        defaults: { tokens_consumed: 0 }
      });
      await registro.increment('tokens_consumed', { by: tokensGastos });

      /* 5. Salva conversa */
      await ChatHistoryHelper.savePair({
        session,
        sessionkey,
        numero: numeroCliente,
        userText: promptUsuario,
        assistantText: textoResposta
      });

      return textoResposta;
    } catch (err) {
      console.error('[IA] Erro:', err);
      return null;
    }
  }
};
