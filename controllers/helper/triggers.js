/**
 *  ┌───────────────────────────────────────────────┐
 *  │  TRIGGERS – Decide se a mensagem chama a IA   │
 *  └───────────────────────────────────────────────┘
 *  • Exporta: necessitaIA(texto)
 *  • Mantém lista de regex que disparam a OpenAI
 */

const TRIGGERS = [
    // intenção de compra / pedido
    /pedido/i, /comprar/i, /fazer.*pedido/i, /quero.*(pizza|lanche|produto)/i,
  
    // cardápio / catálogo
    /card[aá]pio/i, /menu/i, /op[cç][\w]?es/i,
  
    // preço / promo
    /pre[cç]o/i, /valor/i, /custa/i, /promo[cç][aã]o/i,
  
    // logística
    /entrega/i, /hor[aá]rio/i, /funciona/i,
  
    // saudações que costumam iniciar conversa
    /\bbom\s*dia\b/i, /\bboa\s*tarde\b/i, /\bboa\s*noite\b/i
  ];
  
  module.exports = {
    /**
     * Retorna true se o texto bate em algum gatilho.
     * Use antes de chamar a IA para economizar tokens.
     */
    necessitaIA(texto = '') {
      if (!texto.trim()) return false;
      return TRIGGERS.some((rgx) => rgx.test(texto));
    },
  
    /**
     * Permite adicionar triggers em tempo de execução.
     * Ex.: Triggers.add(/cupom/i)
     */
    add(regex) {
      if (regex instanceof RegExp) TRIGGERS.push(regex);
    }
  };
  