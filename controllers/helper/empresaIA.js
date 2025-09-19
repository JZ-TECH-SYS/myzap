'use strict';

require('dotenv').config();

const moment = require('moment');
const OpenAI = require('openai');
const config = require('../../config.js');
const ChatHistoryHelper = require('./chatHistory');

const TokenUsageModel = require('../../Models/tokenUsage.js');
const TokenUsage = TokenUsageModel(config.sequelize);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = {
  async processarMensagem({ session, sessionkey, message, idprompt, vetor }) {
    try {
      const promptUsuario = (message?.body || '').trim();
      const numeroCliente = message?.from;

      if (!promptUsuario) return null;

      const historico = await ChatHistoryHelper.getRecent({
        session,
        sessionkey,
        numero: numeroCliente,
        minutos: 60,
      });

      const inputMsgs = [
        ...historico.map((h) => ({
          type: 'message',
          role: h.role,
          content: h.msg,
        })),
        { type: 'message', role: 'user', content: promptUsuario },
      ];

      const completion = await openai.responses.create({
        prompt: {
          id: idprompt,
          version: '1',
        },
        input: inputMsgs,
        tools: vetor ? [
          {
            type: 'file_search',
            vector_store_ids: [vetor],
          },
        ] : [],
        temperature: 0.9,
      });

      const first = completion.output?.[0];
      if (first?.type === 'tool' && first.name === 'criarPedido') {
        const pedido = first.arguments;
        console.log('[IA] Pedido criado:', pedido);
        await ChatHistoryHelper.clearHistory({ session, sessionkey, numero: numeroCliente });
        return null;
      }

      const textoResposta = completion.output_text?.trim()
        || completion.output?.[0]?.content?.[0]?.text?.trim()
        || null;

      if (!textoResposta) return null;

      const tokensGastos = completion.usage?.total_tokens || 0;
      const mesano = moment().format('YYYYMM');

      const [registro] = await TokenUsage.findOrCreate({
        where: { session, sessionkey, mesano },
        defaults: { tokens_consumed: 0 },
      });
      await registro.increment('tokens_consumed', { by: tokensGastos });

      return textoResposta;
    } catch (err) {
      console.error('[IA] Erro:', err);
      return null;
    }
  },
};
