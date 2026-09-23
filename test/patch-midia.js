/**
 * Patch do `__x_id` (scripts/patch-whatsapp.js): a mídia do whatsapp-web.js 1.34.7 não saía com o
 * WhatsApp Web de 17/09/2026 ("Data passed to getter must include an id property"; loja piloto da
 * Celularis, 23/09/2026). Confere que a linha entra no lugar certo, uma vez só, que o build
 * quebra se o Utils.js mudar de forma, e que o objeto da mensagem sai sem o id privado da mídia.
 *
 * Uso: node test/patch-midia.js  (exit 0 = ok, 1 = quebrou)
 */
const assert = require('assert');
const path = require('path');
const { patchIdDaMidia } = require(path.join(__dirname, '..', 'scripts', 'patch-whatsapp.js'));

// O trecho do window.WWebJS.sendMessage do 1.34.7, reduzido ao que o patch toca.
const utils1347 = `
    window.WWebJS.sendMessage = async (chat, content, options = {}) => {
        const mediaOptions = options.mediaOptions || {};
        delete options.mediaOptions;
        const extraOptions = options.extraOptions || {};
        const botOptions = {};
        const message = {
            ...options,
            id: 'MSG_KEY',
            body: content,
            ...mediaOptions,
            ...(mediaOptions.toJSON ? mediaOptions.toJSON() : {}),
            ...botOptions,
            ...extraOptions,
        };

        // Bot's won't reply if canonicalUrl is set (linking)
        if (botOptions) {
            delete message.canonicalUrl;
        }
        return message;
    };
`;

const corrigido = patchIdDaMidia(utils1347);
assert.strictEqual(corrigido.split('delete message.__x_id;').length - 1, 1, 'a linha entra uma vez');
assert.ok(/\.\.\.extraOptions,\n {8}\};\n\n {8}\/\/ MediaData[^\n]*\n {8}delete message\.__x_id;\n\n {8}\/\/ Bot's won't reply/.test(corrigido),
  'logo depois do objeto da mensagem, antes do canonicalUrl');
assert.strictEqual(patchIdDaMidia(corrigido), corrigido, 'idempotente');
assert.throws(() => patchIdDaMidia('window.WWebJS.sendMessage = async () => {};'), /âncora do __x_id/, 'Utils.js de outra forma quebra o build');

// O trecho corrigido roda: o modelo da mídia (com `__x_id` enumerável) não leva o id privado junto.
const window = { WWebJS: {} };
new Function('window', corrigido)(window);
(async () => {
  const midia = { __x_id: 'id-do-MediaData', mimetype: 'image/jpeg', filehash: 'h' };
  const msg = await window.WWebJS.sendMessage({}, 'legenda', { mediaOptions: midia });
  assert.ok(!('__x_id' in msg), 'sem o __x_id da mídia');
  assert.strictEqual(msg.id, 'MSG_KEY', 'o id do Msg fica');
  assert.strictEqual(msg.mimetype, 'image/jpeg', 'o resto da mídia segue');
  console.log('patch-midia: ok');
})().catch((e) => { console.error('patch-midia: QUEBROU —', e.message); process.exit(1); });
