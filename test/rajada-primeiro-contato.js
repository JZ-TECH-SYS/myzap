/**
 * Rajada no primeiro contato: o que chega enquanto a mensagem padrão sai NÃO vai para a IA.
 * Capucho (25/09/2026 17:28): fornecedor mandou "Boa tarde! Já estão valendo as ofertas…" e o
 * panfleto no mesmo segundo. O texto levou a mensagem padrão + cardápio; a imagem ficou na fila
 * do processingLock, foi drenada e a IA respondeu "Não consigo visualizar imagens por aqui!".
 * decisionEngine e processingLock REAIS; guards, envio e agente por require.cache.
 *
 * Uso: node test/rajada-primeiro-contato.js  (exit 0 = ok, 1 = quebrou)
 */
const path = require('path');
const assert = require('assert');

const raiz = path.join(__dirname, '..');
const resolver = (rel) => require.resolve(path.join(raiz, rel));
const stub = (rel, exports) => {
  const arquivo = resolver(rel);
  require.cache[arquivo] = { id: arquivo, filename: arquivo, loaded: true, exports };
};
const livre = async () => ({ shouldBlock: false });
let lojaJaFalou = false;
const atendidas = [];
let durantePadrao = null; // chega outra mensagem enquanto a padrão está saindo
stub('controllers/helper/ia/guards.js', {
  checkGroupMessage: livre, checkCompanyEnabled: livre, checkIaEnabled: livre,
  checkHumanRequest: livre, checkClientRequestedHuman: livre, checkRecentHuman: livre,
  checkFirstContactToday: async () => (lojaJaFalou ? { shouldBlock: false } : { shouldBlock: true, reason: 'primeiro_contato' }),
});
stub('controllers/helper/ia/defaultMessageService.js', {
  sendDefault: async () => { if (durantePadrao) await durantePadrao(); lojaJaFalou = true; return true; },
});
stub('controllers/helper/ia/empresaIA.js', {});
stub('controllers/helper/ia/agenteClient.js', { atender: async (a) => { atendidas.push(a.texto); return { texto: 'resposta da IA' }; }, falar: async () => null });
stub('controllers/helper/events/messageSender.js', new Proxy({}, { get: () => async () => true }));
stub('controllers/helper/events/chatHistory.js', new Proxy({}, { get: () => async () => null }));
stub('util/customLogger.js', new Proxy({}, { get: () => () => {} }));
stub('controllers/helper/ia/iaResponseCache.js', { registerIAResponse() {}, registerSystemMedia() {} });

globalThis.process.env.IA_PROVIDER = 'agente';
const DecisionEngine = require(resolver('controllers/helper/ia/decisionEngine.js'));
const numero = '116231042543646@lid';
const empresa = { mensagem_padrao: 'Olá! Cardápio: https://loja', ia_ativa: true };
const msg = (texto) => DecisionEngine.process({
  message: { body: texto, from: numero, type: 'chat', _data: {} },
  client: { getContactById: async () => ({ pushname: 'Cristiano' }) },
  session: 'CapuchoLanches', sessionkey: 'CapuchoLanches', numero, msgBody: texto,
  empresa, payload: {}, responseDefault: async () => {},
});
const drenar = () => new Promise((r) => setTimeout(r, 50));

(async () => {
  durantePadrao = () => msg('[imagem]');
  await msg('Boa tarde! Já estão valendo as ofertas especiais');
  durantePadrao = null;
  await drenar();
  assert.deepEqual(atendidas, [], 'a imagem que chegou durante a mensagem padrão foi para a IA');
  console.log('ok   rajada no primeiro contato: a segunda mensagem não vai para a IA');

  await msg('quero pedir um x-bacon');
  await drenar();
  assert.deepEqual(atendidas, ['quero pedir um x-bacon'], 'depois da mensagem padrão, quem escreve de novo é atendido');
  console.log('ok   quem insiste depois da mensagem padrão é atendido pela IA');
  process.exit(0);
})().catch((e) => { console.error('QUEBROU:', e.message); process.exit(1); });
