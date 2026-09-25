/**
 * O PIX copia-e-cola que o agente manda vai numa mensagem SÓ DELE.
 *
 * No WhatsApp, copiar uma mensagem copia o texto inteiro — e o app do banco
 * recusa o código com "segue o PIX de R$ 149,00" grudado. O agente põe o código
 * numa linha sozinha (o fim da resposta); aqui essa linha vira outra mensagem,
 * depois do texto. Sem código na resposta, nada muda.
 *
 * O código tem espaço no meio (nome do recebedor: "LUCIMAR COLOMBO SEMI JOIA"),
 * por isso a linha é casada do 000201 até o CRC (6304 + 4 hex), não por \S+.
 */
const LINHA_PIX = /^\s*(000201\S[^\n]*?6304[0-9A-Fa-f]{4})\s*$/;

function separarPix(texto) {
  const linhas = String(texto || '').split('\n');
  const codigos = linhas.filter((l) => LINHA_PIX.test(l)).map((l) => l.trim());
  if (!codigos.length) return [texto];
  const resto = linhas.filter((l) => !LINHA_PIX.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return [...(resto ? [resto] : []), ...codigos];
}

module.exports = { separarPix };
