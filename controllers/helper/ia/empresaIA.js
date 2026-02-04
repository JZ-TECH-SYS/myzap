"use strict";

require("dotenv").config();

const moment = require("moment");
const OpenAI = require("openai");
const crypto = require("crypto");
const config = require("../../../config.js");
const ChatHistoryHelper = require("../events/chatHistory");

const TokenUsageModel = require("../../../Models/tokenUsage.js");
const TokenUsage = TokenUsageModel(config.sequelize);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Gera uma chave de shard para agrupar clientes similares.
 * Isso melhora o cache hit rate da OpenAI porque requests com o mesmo
 * prompt_cache_key são roteadas para o mesmo servidor.
 * @param {string} value - Valor para calcular o shard (ex: número do cliente)
 * @param {number} buckets - Número de buckets/shards (padrão: 8)
 * @returns {number} Número do shard (0 a buckets-1)
 */
function shardKey(value, buckets = 8) {
  if (!value) return 0;
  const hash = crypto.createHash('md5').update(String(value)).digest();
  return hash.readUInt32BE(0) % buckets;
}

function extrairNomeDoHistorico(historico) {
  // procura a última vez que o bot perguntou o nome
  const idx = [...historico]
    .reverse()
    .findIndex(
      (h) =>
        (h.role === "assistant" || h.role === "bot") &&
        /qual\s+seu\s+nome\??/i.test(h.msg || ""),
    );

  if (idx === -1) return "";

  // converter idx reverso para idx normal
  const realIdx = historico.length - 1 - idx;

  // pega a próxima msg do usuário após a pergunta
  const next = historico.slice(realIdx + 1).find((h) => h.role === "user");
  if (!next) return "";

  const txt = (next.msg || "").trim();

  // heurística simples: 1-4 palavras, sem números demais
  const palavras = txt.split(/\s+/).filter(Boolean);
  const temMuitosNumeros = (txt.match(/\d/g) || []).length >= 3;

  if (palavras.length >= 1 && palavras.length <= 4 && !temMuitosNumeros) {
    return txt.replace(/[^\p{L}\s'-]/gu, "").trim();
  }
  return "";
}

module.exports = {
  async processarMensagem({ session, sessionkey, message, idprompt, vetor }) {
    try {
      const promptUsuario = (message?.body || "").trim();
      const numeroCliente = message?.from;

      if (!promptUsuario) return null;

      const historico = await ChatHistoryHelper.getRecent({
        session,
        sessionkey,
        numero: numeroCliente,
        minutos: 20,
      });

      const inputMsgs = [
        ...historico.map((h) => ({
          type: "message",
          // OpenAI só aceita: assistant, system, developer, user
          // Mapear 'agent' (humano) para 'assistant' 
          role: h.role === 'agent' ? 'assistant' : h.role,
          content: h.msg,
        })),
        { type: "message", role: "user", content: promptUsuario },
      ];

      const nomeCliente = extrairNomeDoHistorico(historico);
      
      // Monta tools com MCP se tiver configurado
      const tools = [];
      if (process.env.MCP_URL && process.env.MCP_TOKEN) {
        console.log("[IA] MCP configurado, adicionando tool MCP");
        tools.push({
          type: "mcp",
          server_label: "click_express",
          server_url: process.env.MCP_URL,
          require_approval: "never",
          authorization: process.env.MCP_TOKEN,
        });
      }

      // Prompt Caching: agrupa clientes em shards para melhorar cache hits
      // O shard garante que clientes similares sejam roteados pro mesmo servidor
      // Limite de 64 chars para prompt_cache_key - usa hash curto do idprompt
      const shard = shardKey(numeroCliente, 8);
      const promptHash = crypto.createHash('md5').update(idprompt).digest('hex').slice(0, 8);
      const promptCacheKey = `ce:${promptHash}:s${shard}`;
      
      const completion = await openai.responses.create({
        prompt: { 
          id: idprompt,
          variables: {
            sessionkey,
            numero_cliente: numeroCliente,
            nome_cliente: nomeCliente,
          },
        },
        input: inputMsgs,
        prompt_cache_key: promptCacheKey,
        // prompt_cache_retention: "24h" só funciona em gpt-5.1+, gpt-4.1
        // GPT-5-mini usa cache padrão de 5-10 min
        ...(tools.length > 0 && { tools }),
      });

      const textoResposta =
        completion.output_text?.trim() ||
        completion.output?.[0]?.content?.[0]?.text?.trim() ||
        null;

      // Log de métricas do cache
      const cachedTokens = completion.usage?.input_tokens_details?.cached_tokens || 0;
      const inputTokens = completion.usage?.input_tokens || 0;
      const cacheHitRate = inputTokens > 0 ? ((cachedTokens / inputTokens) * 100).toFixed(1) : 0;
      console.log(`[IA] Tokens: ${inputTokens} input | ${cachedTokens} cached (${cacheHitRate}% hit) | ${completion.usage?.output_tokens || 0} output`);

      console.log("Resposta [IA] :", textoResposta);

      if (!textoResposta) return null;

      const tokensGastos = completion.usage?.total_tokens || 0;
      const mesano = moment().format("YYYYMM");

      const [registro] = await TokenUsage.findOrCreate({
        where: { session, sessionkey, mesano },
        defaults: { tokens_consumed: 0 },
      });
      await registro.increment("tokens_consumed", { by: tokensGastos });

      return textoResposta;
    } catch (err) {
      console.error("[IA] Erro:", err);
      return null;
    }
  },
};
