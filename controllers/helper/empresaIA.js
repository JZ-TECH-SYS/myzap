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

require('dotenv').config();
const moment  = require('moment');
const OpenAI  = require('openai');                     // SDK oficial
const config  = require('../../config.js');

const Triggers          = require('./triggers');
const ChatHistoryHelper = require('./chatHistory');

const TokenUsageModel = require('../../Models/tokenUsage.js');
const TokenUsage      = TokenUsageModel(config.sequelize);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = {
  /**
   * Processa a mensagem recebida:
   * 1. verifica triggers  · 2. monta histórico  · 3. chama OpenAI
   * 4. grava histórico e tokens  · 5. devolve texto de resposta
   */
  async processarMensagem({ session, sessionkey, message }, { skipTriggers = false } = {}) {
    try {
      const promptUsuario  = (message?.body || '').trim();
      const numeroCliente  = message?.from;      // JID completo

      if (!promptUsuario) return null;

      /* ---------- 1. Confere gatilhos para economizar tokens ---------- */
      if (!skipTriggers  && !Triggers.necessitaIA(promptUsuario)) {
        console.log('[IA] Nenhum trigger – não chamou OpenAI');
        return null;
      }

      /* ---------- 2. Busca histórico das últimas 1h ---------- */
      const historico = await ChatHistoryHelper.getRecent({
        session,
        sessionkey,
        numero: numeroCliente,
        minutos: 60
      });

      /* ---------- 3. Monta prompt ---------- */
      const messages = [
        {
          role: 'system',
          content: 'Você é atendente da empresa. Seja claro, educado e objetivo.'
        },
        ...historico.map(h => ({ role: h.role, content: h.msg })),
        { role: 'user', content: promptUsuario }
      ];

      /* ---------- 4. Chama OpenAI ---------- */
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages
      });

      const textoResposta = completion.choices?.[0]?.message?.content?.trim() || null;
      if (!textoResposta) return null;

      /* ---------- 5. Grava tokens do mês ---------- */
      const tokensGastos = completion.usage?.total_tokens || 0;
      const mesano       = moment().format('YYYYMM');

      const [registro] = await TokenUsage.findOrCreate({
        where: { session, sessionkey, mesano },
        defaults: { tokens_consumed: 0 }
      });
      await registro.increment('tokens_consumed', { by: tokensGastos });

      /* ---------- 6. Salva par user/assistant no histórico ---------- */
      await ChatHistoryHelper.savePair({
        session,
        sessionkey,
        numero: numeroCliente,
        userText: promptUsuario,
        assistantText: textoResposta
      });

      return textoResposta;
    } catch (err) {
      console.error('[IA] Erro:', err.message);
      return null;
    }
  }
};
