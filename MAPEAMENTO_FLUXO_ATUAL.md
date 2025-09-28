# 🗺️ MAPEAMENTO DO FLUXO DE IA ATUAL

## 🏗️ **ARQUITETURA EXISTENTE (FUNCIONAL)**

### 📊 **1. TABELA PRINCIPAL: `DeviceCompany`**
```sql
-- ✅ CAMPOS JÁ IMPLEMENTADOS E FUNCIONAIS:
session                 -> identificação da sessão
sessionkey             -> chave da sessão  
ia_ativa               -> LIGA/DESLIGA IA (boolean)
idprompt               -> ID do prompt no OpenAI
vector_name            -> nome do vetor para RAG
mensagem_padrao        -> mensagem quando IA está off
tempo_mensagem_padrao  -> cooldown da mensagem padrão
```

### 🔄 **2. FLUXO PRINCIPAL (EventsController)**
```
Mensagem recebida 
    ↓
🔍 Verificar se é empresa habilitada (DeviceCompany)
    ↓
🎯 Verificar se IA está ativa (ia_ativa = true)
    ↓
⏰ Verificar cooldowns (humano falou recentemente?)
    ↓
🎪 Verificar triggers (necessitaIA - regex patterns)
    ↓
🤖 Chamar EmpresaIA.processarMensagem()
    ↓
📤 Enviar resposta da IA
```

### 🧠 **3. SISTEMA DE IA (EmpresaIA)**
```javascript
// JÁ FUNCIONA:
EmpresaIA.processarMensagem({
  session,
  sessionkey, 
  message,
  idprompt,    // ✅ Prompt já configurado no OpenAI
  vetor        // ✅ Vector store para RAG
})
```

### 🎯 **4. TRIGGERS AUTOMÁTICOS**
```javascript
// ✅ REGEX PATTERNS FUNCIONAIS:
- /pedido/i, /comprar/i
- /cardápio/i, /menu/i  
- /preço/i, /valor/i
- /entrega/i, /horário/i
- /bom dia/i, /boa tarde/i
```

---

## 🎯 **O QUE PRECISAMOS CRIAR (SIMPLES)**

### 📱 **INTERFACE ADMINISTRATIVA**

#### **1. Listar Sessões + Toggle IA**
```
┌─────────────────────────────────────────────┐
│ 📱 GERENCIAR SESSÕES IA                     │
├─────────────────────────────────────────────┤
│ Sessão          │ Status IA │ Prompt  │ Ação │
│ joaovendas      │    🟢 ON  │ Pizza   │ [OFF]│
│ mariafarmacia   │    🔴 OFF │ Remédio │ [ON] │
│ pedrovarejo     │    🟢 ON  │ Loja    │ [OFF]│
└─────────────────────────────────────────────┘
```

#### **2. Configurações Globais (Simples)**  
```
┌─────────────────────────────────────────────┐
│ ⚙️ CONFIGURAÇÕES GLOBAIS IA                 │
├─────────────────────────────────────────────┤
│ Modelo: GPT-4o-mini                         │
│ Temperatura: 0.7                            │
│ Cooldown IA: 45 segundos                    │
│ Pausa após humano: 10 minutos               │
│ Aceitar áudio: ✅ Sim                       │
└─────────────────────────────────────────────┘
```

---

## 🚀 **REFATORAÇÃO NECESSÁRIA**

### ❌ **REMOVER (COMPLICAÇÕES DESNECESSÁRIAS)**
- ❌ Tabelas: `ia_triggers`, `ia_human_takeover`, `ia_action_logs`
- ❌ Models: `iaTrigger.js`, `iaHumanTakeover.js`, `iaActionLog.js`
- ❌ Controllers complexos de configuração
- ❌ Validações excessivas
- ❌ Telas complexas de dashboard

### ✅ **MANTER/CRIAR (ESSENCIAL)**
- ✅ Tabela `DeviceCompany` (já existe e funciona!)
- ✅ `EventsController` (já funciona!)
- ✅ `EmpresaIA` helper (já funciona!)
- ✅ Interface simples para ligar/desligar IA
- ✅ Listagem de sessões ativas
- ✅ Configurações básicas globais

---

## 🎯 **PLANO DE EXECUÇÃO SIMPLIFICADO**

### **FASE 1: LIMPAR O EXCESSO** ❌
1. Remover migrations desnecessárias
2. Remover models complexos  
3. Remover controllers excessivos

### **FASE 2: CRIAR O ESSENCIAL** ✅
1. Controller simples: `IASimpleController.js`
2. View simples: `ia-manager.ejs` 
3. Rotas básicas: listar + toggle
4. Integração no sidebar

### **FASE 3: TESTAR E VALIDAR** 🧪
1. Testar toggle ON/OFF
2. Validar funcionamento da IA
3. Confirmar interface funcional

---

## 💡 **RESUMO: MENOS É MAIS!**

**✅ O que JÁ FUNCIONA:**
- Sistema de IA completo no EventsController
- Integração com OpenAI + RAG
- Controle por `ia_ativa` na DeviceCompany
- Triggers automáticos funcionais

**🎯 O que PRECISAMOS:**
- Interface administrativa SIMPLES
- Toggle para ligar/desligar IA por sessão
- Visualização básica do status

**🚫 O que NÃO PRECISAMOS:**
- Sistemas complexos de logs
- Configurações avançadas por sessão  
- Dashboards elaborados
- Múltiplas tabelas de controle

**🎪 FOCO: Uma tela simples para gerenciar o que já existe e funciona!**
