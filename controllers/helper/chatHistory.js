/**
 *  ┌───────────────────────────────────────────────┐
 *  │  CHAT HISTORY – Ler / gravar histórico no DB  │
 *  └───────────────────────────────────────────────┘
 *  • Exporta:
 *      getRecent({ session, sessionkey, numero, minutos })
 *      savePair({ session, sessionkey, numero, userText, assistantText })
 */

const moment = require('moment');
const { Op } = require('sequelize');

const config = require('../../config.js');
const ChatHistoryModel = require('../../Models/chatHistory.js');

const ChatHistory = ChatHistoryModel(config.sequelize);

module.exports = {
  /**
   * Busca mensagens dos últimos X minutos (default 60).
   * Ordenadas de forma ascendente (mais antigas primeiro).
   */
  async getRecent({ session, sessionkey, numero, minutos = 60 }) {
    const desde = moment().subtract(minutos, 'minutes').toDate();

    return await ChatHistory.findAll({
      where: {
        session,
        sessionkey,
        numero_cliente: numero,
        created_at: { [Op.gte]: desde }
      },
      order: [['id', 'ASC']]
    });
  },

  /**
   * Busca mensagens do dia atual. 
   * caso ainda não tenha mensagens, retorna msg padrao 
   * caso tenha mensagens e foi da IA continua a conversa
   */
  async hasRecent({ session, sessionkey, numero, minutos = 30 }) {
    const desde = moment().subtract(minutos, 'minutes').toDate();
    const qtd = await ChatHistory.count({
      where: {
        session,
        sessionkey,
        numero_cliente: numero,
        created_at: { [Op.gte]: desde }
      }
    });
    return qtd > 0;
  },

  /**
   * grava msg de boas vindas pra não ficar repetindo msg padrão caso ia não responda
   */
  async hasBotRecent({ session, sessionkey, numero, minutos = 30 }) {
    const desde = moment().subtract(minutos, 'minutes').toDate();
    const qtd = await ChatHistory.count({
      where: {
        session,
        sessionkey,
        numero_cliente: numero,
        role: 'assistant',
        created_at: { [Op.gte]: desde }
      }
    });
    return qtd > 0;
  },


  /**
   * Grava par (usuário + assistente) numa tacada só.
   */
  async savePair({ session, sessionkey, numero, userText, assistantText }) {
    if (!userText && !assistantText) return;

    const rows = [];
    if (userText) {
      rows.push({ session, sessionkey, numero_cliente: numero, role: 'user', msg: userText });
    }
    if (assistantText) {
      rows.push({ session, sessionkey, numero_cliente: numero, role: 'assistant', msg: assistantText });
    }
    if (rows.length) await ChatHistory.bulkCreate(rows);
  },

  /**
   * Remove registros mais antigos que 'dias' (default 1).
   * Pode ser chamado por um cron diário.
   */
  async purgeOld(days = 1) {
    const limite = moment().subtract(days, 'days').toDate();
    await ChatHistory.destroy({ where: { created_at: { [Op.lt]: limite } } });
  },

  /**
   * Remove todos os registros de uma sessão. e numero.
   */
  async clearHistory({ session, sessionkey, numero }) {
    await ChatHistory.destroy({
      where: { session, sessionkey, numero_cliente: numero }
    });
  },

};
