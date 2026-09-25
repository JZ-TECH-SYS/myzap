// O PIX copia-e-cola do agente sai numa mensagem só dele: node test/separar-pix.js
const assert = require('node:assert/strict');
const { separarPix } = require('../controllers/helper/ia/separarPix');

const COD = '00020126360014br.gov.bcb.pix0114147234210001555204000053039865406149.005802BR5925LUCIMAR COLOMBO SEMI JOIA6009DOURADINA62110507WPP75946304FE1A';

assert.deepEqual(separarPix(`Segue o PIX das 2 parcelas: *R$ 149,00*\nDepois de pagar, me manda o comprovante 🙂\n\n${COD}`),
  ['Segue o PIX das 2 parcelas: *R$ 149,00*\nDepois de pagar, me manda o comprovante 🙂', COD], 'texto e código em mensagens separadas');
assert.deepEqual(separarPix(COD), [COD], 'só o código: uma mensagem');
assert.deepEqual(separarPix('Temos o anel por R$ 125,00: https://x/p?produto=1'), ['Temos o anel por R$ 125,00: https://x/p?produto=1'], 'sem PIX, nada muda');
assert.deepEqual(separarPix(`Pague com este código: ${COD}`), [`Pague com este código: ${COD}`], 'código no meio da frase não é separado (não dá para cortar sem risco)');
console.log('separar-pix: 4 ✓');
