/**
 * `path` das rotas de mídia (sendAudio/sendImage/...): data-URI sai pelas opções do tipo
 * (áudio = nota de voz), URL é baixada em memória (sem files-received/ — dois envios do
 * mesmo nome não se atropelam), caminho local segue como sempre. Sem WhatsApp e sem
 * node_modules: whatsapp-web.js e cia. entram por stub; o fetch e o servidor HTTP são reais.
 *
 * Uso: node test/midia-por-path.js  (exit 0 = ok, 1 = quebrou)
 */
const http = require('http');
const path = require('path');
const assert = require('assert');
const Module = require('module');

const raiz = path.join(__dirname, '..');
const resolver = (rel) => require.resolve(path.join(raiz, rel));
const stub = (rel, exports) => {
  const arquivo = resolver(rel);
  require.cache[arquivo] = { id: arquivo, filename: arquivo, loaded: true, exports };
};

class MessageMedia {
  constructor(mimetype, data, filename) { Object.assign(this, { mimetype, data, filename }); }
  static fromFilePath(p) { return new MessageMedia('local', '', p); }
}
const pacotes = {
  'whatsapp-web.js': { MessageMedia, Location: class {}, Poll: class {} },
  'mime-types': { lookup: (n) => ({ ogg: 'audio/ogg', jpg: 'image/jpeg' })[n.split('.').pop()] || false },
  'async-get-file': async () => { throw new Error('não deveria baixar para o disco'); },
  'url-exists': (u, cb) => cb(null, false),
};
const carregar = Module._load;
Module._load = function (pedido, ...resto) {
  return pedido in pacotes ? pacotes[pedido] : carregar.call(this, pedido, ...resto);
};

const enviados = [];
stub('controllers/SessionsController.js', {
  getSession: () => ({ client: { sendMessage: async (numero, media, opcoes) => {
    enviados.push({ media, opcoes });
    return { id: { _serialized: `id${enviados.length}` }, to: numero };
  } } }),
});
stub('controllers/helper/ia/iaResponseCache.js', { registerSystemMedia: () => {} });
stub('engines/WhatsappWebJS.js', {});
stub('util/cache.js', { get: async () => null });
stub('util/customLogger.js', new Proxy({}, { get: () => () => {} }));
stub('jobs/sessionHealthCheck.js', { registerSendSuccess() {}, registerSendFailure() {}, isClientHealthy: async () => ({ healthy: true }) });

const mensagens = require(resolver('functions/WhatsappWebJS/helper/mensagens.js'));
const chamar = async (rota, body) => {
  const res = { statusCode: 0, corpo: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = res.send = (b) => { res.corpo = b; return res; };
  await mensagens[rota]({ body: { session: 's', number: '5511999999999', ...body } }, res);
  return res;
};
const b64 = (s) => Buffer.from(s).toString('base64');

// Servidor com duas "foto.jpg" de conteúdo diferente, uma nota de voz e um 404.
const arquivos = { '/a/foto.jpg': 'FOTO-A', '/b/foto.jpg': 'FOTO-B', '/voz.ogg': 'OggS-voz' };
const servidor = http.createServer((req, res) => {
  const corpo = arquivos[req.url.split('?')[0]];
  res.statusCode = corpo ? 200 : 404;
  setTimeout(() => res.end(corpo || ''), 20); // devagar o bastante para os dois envios se cruzarem
});

servidor.listen(0, async () => {
  const base = `http://127.0.0.1:${servidor.address().port}`;
  try {
    // 1) voz por data-URI: nota de voz, e o base64 não volta na resposta (o zap a grava)
    let r = await chamar('sendAudio', { path: `data:audio/ogg;codecs=opus;base64,${b64('OggS')}` });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.corpo));
    let e = enviados.pop();
    assert.deepStrictEqual([e.media.mimetype, e.media.data], ['audio/ogg', b64('OggS')]);
    assert.strictEqual(e.opcoes.sendAudioAsVoice, true);
    assert.ok(!JSON.stringify(r.corpo).includes(b64('OggS')), 'data-URI ecoado na resposta');

    // 2) voz por URL assinada: a query não entra no nome, o mimetype sai da extensão
    r = await chamar('sendAudio', { path: `${base}/voz.ogg?X-Goog-Signature=abc` });
    assert.strictEqual(r.statusCode, 200, JSON.stringify(r.corpo));
    e = enviados.pop();
    assert.deepStrictEqual([e.media.mimetype, e.media.data, e.media.filename], ['audio/ogg', b64('OggS-voz'), 'voz.ogg']);
    assert.strictEqual(e.opcoes.sendAudioAsVoice, true);

    // 3) dois envios simultâneos de arquivos com o MESMO nome: cada um leva o seu
    const [ra, rb] = await Promise.all([
      chamar('sendImage', { path: `${base}/a/foto.jpg`, caption: 'a' }),
      chamar('sendImage', { path: `${base}/b/foto.jpg`, caption: 'b' }),
    ]);
    assert.deepStrictEqual([ra.statusCode, rb.statusCode], [200, 200]);
    const porLegenda = Object.fromEntries(enviados.splice(0).map((x) => [x.opcoes.caption, x.media.data]));
    assert.deepStrictEqual(porLegenda, { a: b64('FOTO-A'), b: b64('FOTO-B') });

    // 4) URL que não existe: erro, nada enviado
    r = await chamar('sendImage', { path: `${base}/sumiu.jpg` });
    assert.strictEqual(r.statusCode, 500);
    assert.strictEqual(enviados.length, 0);

    // 5) caminho local continua valendo (frota das lojas)
    r = await chamar('sendFile', { path: '/tmp/cupom.pdf' });
    assert.strictEqual(r.statusCode, 200);
    assert.strictEqual(enviados.pop().media.mimetype, 'local');

    console.log('ok: midia-por-path (5 casos)');
    process.exitCode = 0;
  } catch (err) {
    console.error('FALHOU:', err.message);
    process.exitCode = 1;
  } finally {
    servidor.close();
  }
});
