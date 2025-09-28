/**
 * Helper para detectar quando cliente quer falar com humano
 * Analisa mensagens que indicam preferência por atendimento humano
 */

/**
 * Padrões que indicam pedido de atendimento humano
 */
const HUMAN_REQUEST_PATTERNS = [
  // Pedidos diretos
  /\b(quero|preciso|gostaria|pode|podem)\s+(falar|conversar|atender|atendimento)\s+(com|por)\s+(pessoa|humano|atendente|operador|gente|algu[eé]m)\b/i,
  
  // Rejeição ao robô/IA
  /\b(n[aã]o|não)\s+(quero|gosto|aceito|queria|desejo).*(rob[ôo]|bot|intelig[êe]ncia|artificial|autom[áa]tico)\b/i,
  /\b(sair|parar|pare).*(rob[ôo]|bot|intelig[êe]ncia|artificial|autom[áa]tico)\b/i,
  
  // Expressões específicas
  /\batendente\s+(humano|real|verdadeiro|pessoa|gente)\b/i,
  /\b(falar|conversar)\s+com\s+(pessoa|gente|algu[eé]m|ser\s+humano)\b/i,
  /\b(transferir|passar).*(humano|pessoa|atendente|operador)\b/i,
  /\bpessoa\s+(real|de\s+verdade|humana)\b/i,
  
  // Palavras-chave simples (cuidado com falsos positivos)
  /\b(atendente|operador|supervisor|gerente)\b(?!\s+(virtual|autom[áa]tico|rob[ôo]))/i,
  
  // Expressões de frustração com bot
  /\bvoc[êe]\s+[eé]\s+(rob[ôo]|bot|m[áa]quina)\?/i,
  /\b(sou|estou)\s+falando\s+com\s+(rob[ôo]|bot|m[áa]quina)/i,
  
  // Pedidos educados
  /\bpor\s+favor.*(pessoa|humano|atendente)/i,
  /\bpoderia.*(transferir|passar|chamar).*(pessoa|humano|atendente)/i
];

/**
 * Mensagens de resposta quando detectar pedido de humano
 */
const HUMAN_REQUEST_RESPONSES = [
  "Entendi! Vou transferir você para um dos nossos atendentes. Por favor, aguarde um momento que alguém da nossa equipe irá te atender. 😊",
  "Claro! Estou chamando um atendente humano para você. Em breve alguém da nossa equipe entrará em contato. Obrigado pela paciência! 👨‍💼",
  "Perfeito! Vou passar seu atendimento para uma pessoa da nossa equipe. Aguarde só um instante que já vão te atender. 🙋‍♀️",
  "Ok! Entendido. Estou transferindo para atendimento humano. Nossa equipe já vai entrar em contato com você. Obrigado! 👥"
];

module.exports = {
  /**
   * Detecta se a mensagem indica pedido de atendimento humano
   * @param {string} texto - Texto da mensagem do cliente
   * @returns {boolean} - true se detectou pedido de humano
   */
  detectarPedidoHumano(texto) {
    if (!texto || typeof texto !== 'string') {
      return false;
    }

    const textoLimpo = texto.trim().toLowerCase();
    
    // Verifica cada padrão
    for (const pattern of HUMAN_REQUEST_PATTERNS) {
      if (pattern.test(textoLimpo)) {
        return true;
      }
    }
    
    return false;
  },

  /**
   * Retorna uma mensagem aleatória de transferência para humano
   * @returns {string} - Mensagem de transferência
   */
  getMensagemTransferencia() {
    const index = Math.floor(Math.random() * HUMAN_REQUEST_RESPONSES.length);
    return HUMAN_REQUEST_RESPONSES[index];
  },

  /**
   * Log para debug - mostra qual padrão foi detectado
   * @param {string} texto - Texto analisado
   * @returns {string|null} - Descrição do padrão encontrado
   */
  debugDeteccao(texto) {
    if (!texto) return null;
    
    const textoLimpo = texto.trim().toLowerCase();
    
    for (let i = 0; i < HUMAN_REQUEST_PATTERNS.length; i++) {
      const pattern = HUMAN_REQUEST_PATTERNS[i];
      if (pattern.test(textoLimpo)) {
        return `Padrão ${i + 1} detectado: ${pattern.source}`;
      }
    }
    
    return null;
  }
};
