"use strict";

require("dotenv").config();

const moment = require("moment");
const OpenAI = require("openai");
const config = require("../../../config.js");
const ChatHistoryHelper = require("../events/chatHistory");

const TokenUsageModel = require("../../../Models/tokenUsage.js");
const TokenUsage = TokenUsageModel(config.sequelize);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
          role: h.role,
          content: h.msg,
        })),
        { type: "message", role: "user", content: promptUsuario },
      ];

      const nomeCliente = extrairNomeDoHistorico(historico);
      
      // Monta tools com MCP se tiver configurado
      const tools = [];
      if (process.env.MCP_URL && process.env.MCP_TOKEN) {
        tools.push({
          type: "mcp",
          server_label: "click_express",
          server_url: process.env.MCP_URL,
          require_approval: "never",
          authorization: `Bearer ${process.env.MCP_TOKEN}`,
        });
      }

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
        ...(tools.length > 0 && { tools }),
      });

      const textoResposta =
        completion.output_text?.trim() ||
        completion.output?.[0]?.content?.[0]?.text?.trim() ||
        null;

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
