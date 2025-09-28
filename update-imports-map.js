/**
 * Script para atualizar imports após reorganização de helpers
 * 
 * MAPEAMENTO DE MUDANÇAS:
 * 
 * DE -> PARA
 * ./helper/empresaIA -> ./helper/ia/empresaIA
 * ./helper/humanDetector -> ./helper/ia/humanDetector  
 * ./helper/iaConfig -> ./helper/ia/iaConfig
 * ./helper/audioTranscriber -> ./helper/events/audioTranscriber
 * ./helper/chatHistory -> ./helper/events/chatHistory
 * ./helper/connectionStateManager -> ./helper/events/connectionStateManager
 * ./helper/events -> ./helper/events/events
 * ./helper/messageSender -> ./helper/events/messageSender
 * ./helper/outboundMessageProcessor -> ./helper/events/outboundMessageProcessor
 * ./helper/socketWebhookManager -> ./helper/events/socketWebhookManager
 * ./helper/statusAckManager -> ./helper/events/statusAckManager
 * ./helper/triggers -> ./helper/events/triggers
 * ./helper/http -> ./helper/core/http
 * ./helper/sessions -> ./helper/core/sessions
 * ./helper/usage -> ./helper/core/usage
 * ./helper/webhooks -> ./helper/core/webhooks
 */

console.log('Mapa de mudanças criado. Use este arquivo como referência para atualizações manuais.');
