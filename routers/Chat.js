const express = require('express');
const Router = express.Router();
const { Op } = require('sequelize');

const config = require('../config');
const ChatHistoryModel = require('../Models/chatHistory.js');
const customLogger = require('../util/customLogger.js'); // ✅ Logger padronizado

const ChatHistory = ChatHistoryModel(config.sequelize);

Router.post('/api/chat/limpar-historico', async (req, res) => {
  try {
    const { session, sessionkey } = req.body || {};

    if (!session || !sessionkey) {
      return res.status(400).json({ status: 'erro', mensagem: 'Parâmetros inválidos' });
    }

    const inicioHoje = new Date();
    inicioHoje.setHours(0, 0, 0, 0);

    await ChatHistory.destroy({
      where: {
        session,
        sessionkey,
        created_at: { [Op.lt]: inicioHoje }
      }
    });

    res.json({ status: 'ok', mensagem: 'Histórico limpo com sucesso.' });
  } catch (err) {
    customLogger.error('Erro ao limpar histórico:', err);
    res.status(500).json({ status: 'erro', mensagem: 'Erro interno' });
  }
});

module.exports = Router;
