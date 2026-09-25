/**
 * Primeiro contato do dia: o "oi" do cliente tem de receber a mensagem padrão, não a IA.
 *
 * Capucho (24/09/2026): o EventsController grava a fala do cliente ANTES dos guards, e o
 * jaInteragiuHoje contava tudo — a própria mensagem virava "interação anterior", o guard
 * primeiro_contato nunca bloqueava texto e a IA respondia ao "oi". Roda o chatHistory REAL
 * contra um SQLite em memória.
 *
 * Uso: node test/primeiro-contato.js  (exit 0 = ok, 1 = quebrou)
 */
const path = require('path');
const assert = require('assert');
const { Sequelize } = require('sequelize');

const raiz = path.join(__dirname, '..');
const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
const arquivo = require.resolve(path.join(raiz, 'config.js'));
require.cache[arquivo] = { id: arquivo, filename: arquivo, loaded: true, exports: { sequelize } };

const ChatHistoryHelper = require(path.join(raiz, 'controllers/helper/events/chatHistory.js'));
const k = { session: 's', sessionkey: 'CapuchoLanches', numero: '152574535688336@lid' };

let falhas = 0;
const caso = async (nome, fn) => {
  try { await fn(); console.log(`ok   ${nome}`); } catch (e) { falhas++; console.log(`FALHOU ${nome}: ${e.message}`); }
};

(async () => {
  await sequelize.getQueryInterface().createTable('chat_history', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    session: Sequelize.TEXT, sessionkey: Sequelize.TEXT, numero_cliente: Sequelize.TEXT,
    role: Sequelize.TEXT, msg: Sequelize.TEXT, message_type: Sequelize.STRING, created_at: Sequelize.DATE,
  });

  await caso('o "oi" gravado antes dos guards não conta como interação anterior', async () => {
    await ChatHistoryHelper.registerUserMessage({ ...k, text: 'oi' });
    assert.strictEqual(await ChatHistoryHelper.jaInteragiuHoje(k), false);
  });
  await caso('depois da mensagem padrão, a próxima mensagem já não é primeiro contato', async () => {
    await ChatHistoryHelper.registerAssistantMessage({ ...k, text: 'Olá! Acesse o cardápio', messageType: 'mensagem_padrao' });
    assert.strictEqual(await ChatHistoryHelper.jaInteragiuHoje(k), true);
  });
  await caso('atendente que falou hoje também conta', async () => {
    const outro = { ...k, numero: '999@lid' };
    await ChatHistoryHelper.registerAgentMessage({ ...outro, text: 'boa noite, já te atendo' });
    assert.strictEqual(await ChatHistoryHelper.jaInteragiuHoje(outro), true);
  });

  console.log(falhas === 0 ? '\ntudo certo' : `\n${falhas} caso(s) falharam`);
  process.exit(falhas === 0 ? 0 : 1);
})();
