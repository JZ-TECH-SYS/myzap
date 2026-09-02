/**
 * Smoke do fluxo IA: decisionEngine REAL de ponta a ponta com IA_PROVIDER=agente.
 *
 * Motivação (31/08/2026): a função exportada do decisionEngine chama-se
 * "process" e sombreava o global do Node — process.env.IA_PROVIDER dava
 * TypeError em TODA mensagem, engolido pelo catch genérico. Passou por duas
 * releases porque nada exercitava o caminho completo. Este smoke falha na hora
 * se a mensagem não atravessar guards -> roteamento -> AgenteClient -> sendText.
 *
 * Sem banco e sem WhatsApp: módulos de borda (chatHistory, messageSender,
 * empresaIA, defaultMessageService, iaResponseCache) entram por require.cache;
 * guards, agenteClient, processingLock e o decisionEngine rodam REAIS.
 * O "agente" é um HTTP local que devolve uma resposta fixa.
 *
 * Uso: node test/smoke-ia.js  (exit 0 = ok, 1 = quebrou)
 */
const http = require('http');
const path = require('path');

const raiz = path.join(__dirname, '..');
const resolver = (rel) => require.resolve(path.join(raiz, rel));

const chamadas = { sendText: [], sendDefault: [] };

const stub = (rel, exports) => {
  const arquivo = resolver(rel);
  require.cache[arquivo] = { id: arquivo, filename: arquivo, loaded: true, exports };
};

// Bordas: histórico diz "já interagiu hoje" (senão o guard primeiro_contato
// bloqueia antes da IA) e nega qualquer sinal de humano na conversa.
stub('controllers/helper/events/chatHistory.js', {
  jaInteragiuHoje: async () => true,
  humanoFalouRecentemente: async () => false,
  clientePediuHumano: async () => false,
  marcarPedidoHumano: async () => {},
  registerAssistantMessage: async () => {},
});
stub('controllers/helper/events/messageSender.js', {
  startTyping: async () => {},
  stopTyping: async () => {},
  sendText: async ({ text }) => { chamadas.sendText.push(text); },
});
stub('controllers/helper/ia/defaultMessageService.js', {
  sendDefault: async (args) => { chamadas.sendDefault.push(args?.motivo ?? args); },
});
// empresaIA puxa OpenAI + sequelize no require — fora do smoke.
stub('controllers/helper/ia/empresaIA.js', { processarMensagem: async () => null });
stub('controllers/helper/ia/iaResponseCache.js', { registerIAResponse: () => {} });
// logger real puxa chalk — stub mantém o smoke sem node_modules (CI leve).
stub('util/customLogger.js', new Proxy({}, {
  get: (_alvo, metodo) => (...args) => console.log(`[${String(metodo)}]`, ...args.map(String)),
}));

const recebidos = [];
const servidor = http.createServer((req, res) => {
  let corpo = '';
  req.on('data', (c) => (corpo += c));
  req.on('end', () => {
    try { recebidos.push(JSON.parse(corpo)); } catch (_) { recebidos.push({ corpo }); }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ resposta: 'pong do agente' }));
  });
});

const main = async () => {
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const porta = servidor.address().port;

  process.env.IA_PROVIDER = 'agente';
  process.env.AGENT_URL = `http://127.0.0.1:${porta}`;
  process.env.AGENT_AUTH_TOKEN = 'smoke';

  const decisionEngine = require(resolver('controllers/helper/ia/decisionEngine.js'));

  const ok = await decisionEngine.process({
    // whatsapp-web.js entrega o pushname em _data.notifyName — é daí que o
    // agente tem de receber o nome (v3.0.18: antes ia sempre null)
    message: { from: '5599000000000@c.us', body: 'bom dia (smoke)', _data: { notifyName: 'Fulano Smoke' } },
    client: {},
    session: 'smoke',
    sessionkey: 'smoke',
    numero: '5599000000000@c.us',
    msgBody: 'bom dia (smoke)',
    empresa: { ia_ativa: true, api_url: null },
    payload: {},
    responseDefault: async () => {},
  });

  servidor.close();

  const respondeu = chamadas.sendText.includes('pong do agente');
  console.log(`processou=${ok} sendText=${JSON.stringify(chamadas.sendText)} sendDefault=${JSON.stringify(chamadas.sendDefault)}`);
  if (!respondeu) {
    console.error('SMOKE FALHOU: a resposta do agente não chegou ao sendText — o fluxo morreu no meio.');
    process.exit(1);
  }
  const nome = recebidos[0]?.nome;
  if (nome !== 'Fulano Smoke') {
    console.error(`SMOKE FALHOU: nome do cliente não chegou ao agente (recebido: ${JSON.stringify(nome)}).`);
    process.exit(1);
  }
  console.log('SMOKE OK: mensagem atravessou guards -> agente -> sendText, com nome do cliente.');
  process.exit(0);
};

main().catch((e) => {
  console.error('SMOKE FALHOU (exceção):', e);
  process.exit(1);
});
