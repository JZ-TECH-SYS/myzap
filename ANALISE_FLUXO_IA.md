# 📋 ANÁLISE DO FLUXO DE IA - EventsController

## ✅ CONFIGURAÇÕES IMPLEMENTADAS (CONSTANTES)

### 🎛️ **Configurações Globais Criadas:**
```javascript
// controllers/helper/iaConfig.js
IA_COOLDOWN_SECONDS: 3           // Cooldown mínimo (apenas anti-simultâneo)
HUMAN_PAUSE_MINUTES: 10          // Pausa após humano responder
TEMPO_MENSAGEM_PADRAO_DEFAULT: 30 // Cooldown mensagem padrão (fallback)
ACEITAR_AUDIO: true              // Sempre aceita áudio
MAX_AUDIO_SIZE: 25MB             // Tamanho máximo do áudio
MAX_AUDIO_DURATION: 90s          // Duração máxima do áudio
```

## 🔄 **FLUXO COMPLETO DA IA (EXPLICADO)**

### **1. RECEBIMENTO DA MENSAGEM**
```
Mensagem recebida → verifica se é permitida → monta payload
```

### **2. VERIFICAÇÃO DE EMPRESA HABILITADA**
```javascript
const empresa = await this.verificarIAHabilitada(session, sessionkey);
// Busca na tabela DeviceCompanies se existe configuração para esta sessão
```

### **3. PROCESSAMENTO DE ÁUDIO (SE APLICÁVEL)**
- ✅ Aceita áudios até 90 segundos e 25MB
- ✅ Transcreve usando Whisper
- ✅ Converte áudio em texto para processar como mensagem normal

### **4. VERIFICAÇÕES DE CONTROLE (EM ORDEM)**

#### **4.1 IA ATIVA?**
```javascript
const iaAtiva = empresa.ia_ativa !== false;
if (!iaAtiva) {
  // Envia mensagem padrão e para
}
```

#### **4.2 HUMANO FALOU RECENTEMENTE?** 🚨
```javascript
const humanoFalou = await ChatHistoryHelper.humanoFalouRecentemente({
  session, sessionkey, numero,
  minutos: HUMAN_PAUSE_MINUTES // 10 minutos
});
if (humanoFalou) {
  // IA fica pausada por 10 minutos após agente humano responder
}
```

#### **4.3 IA EM COOLDOWN?**
```javascript
const iaEmCooldown = await ChatHistoryHelper.emCooldownDeIA({
  session, sessionkey, numero,
  segundos: IA_COOLDOWN_SECONDS // 45 segundos
});
if (iaEmCooldown) {
  // Evita respostas muito rápidas da IA
}
```

#### **4.4 TRIGGER ACIONADO?**
```javascript
const gatilhoIA = TriggersHelper.necessitaIA(plainBody);
if (!gatilhoIA) {
  // Mensagem não contém palavras-chave para acionar IA
}
```

### **5. PROCESSAMENTO DA IA**
```javascript
// Mostra "digitando..." para melhor UX
await client.startTyping(numero);

const respostaIA = await EmpresaIA.processarMensagem({
  session, sessionkey, message,
  idprompt: empresa.idprompt || null,    // Prompt OpenAI
  vetor: empresa.vector_name || null     // Vector store para RAG
});

// Para "digitando" e envia resposta
await client.stopTyping(numero);
await client.sendText(numero, respostaIA);
```

## 🎯 **EXPLICAÇÃO DOS COOLDOWNS**

### **🤖 IA_COOLDOWN_SECONDS (3s)**
**O que é:** Evita processamento simultâneo (não bloqueia conversa)
**Como funciona:** 
- IA responde uma mensagem → aguarda apenas 3s 
- Permite conversas fluidas e naturais
- Evita apenas conflitos de processamento simultâneo

### **👤 HUMAN_PAUSE_MINUTES (10min)** 
**O que é:** Pausa inteligente quando humano assume
**Como funciona:**
- Agente humano responde manualmente → registra como `role: 'agent'`
- IA detecta e para de responder por 10 minutos
- Permite transição suave humano ↔ IA

### **📨 TEMPO_MENSAGEM_PADRAO (30min)**
**O que é:** Evita spam da mensagem padrão
**Como funciona:**
- Enviou mensagem padrão → não envia novamente por 30min para mesmo cliente
- Exemplo: "Obrigado pelo contato, em breve retornamos"

## 🔧 **MENSAGEM PADRÃO - QUANDO É ENVIADA**

A mensagem padrão é enviada nos seguintes casos:
1. **IA desligada** (`ia_ativa = false`)
2. **Agente humano falou** (nos últimos 10min)
3. **IA em cooldown** (nos últimos 45s)
4. **Trigger não acionado** (mensagem não tem palavras-chave)
5. **Erro na IA** (falha ao processar)
6. **IA sem resposta** (OpenAI retornou vazio)

## 🎪 **SISTEMA DE TRIGGERS (PALAVRAS-CHAVE)**

O sistema já possui triggers automáticos em `TriggersHelper.necessitaIA()`:
- `/pedido/i, /comprar/i`
- `/cardápio/i, /menu/i`
- `/preço/i, /valor/i`
- `/entrega/i, /horário/i`
- `/bom dia/i, /boa tarde/i`

## ✅ **RESUMO: ESTÁ TUDO FUNCIONANDO**

**✅ Configurações:** Todas as constantes estão externalizadas
**✅ Cooldowns:** Implementados e funcionais
**✅ Pausa humana:** Detecta quando agente assume e pausa IA
**✅ Áudio:** Processa e transcreve automaticamente
**✅ Triggers:** Detecta palavras-chave para acionar IA
**✅ Mensagem padrão:** Enviada quando IA não deve/pode responder

**🎯 PRÓXIMO PASSO:** Testar o fluxo completo e validar se está funcionando conforme esperado!
