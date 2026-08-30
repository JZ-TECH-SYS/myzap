# 📖 Guia Técnico Completo - Engine WhatsApp-Web-JS no MyZap

> **Versão:** 1.0.0  
> **Última atualização:** Janeiro 2026  
> **Engine:** whatsapp-web.js v1.34.x  
> **Autor:** Documentação gerada para desenvolvedores que não participaram da criação do projeto

---

## 📑 Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Fluxo de Inicialização](#2-fluxo-de-inicialização)
3. [Sistema de Autenticação](#3-sistema-de-autenticação)
4. [Envio e Recebimento de Mensagens](#4-envio-e-recebimento-de-mensagens)
5. [Sistema de Eventos e Listeners](#5-sistema-de-eventos-e-listeners)
6. [Webhooks](#6-webhooks)
7. [Jobs e Manutenção Automática](#7-jobs-e-manutenção-automática)
8. [Pontos Críticos e Problemas Conhecidos](#8-pontos-críticos-e-problemas-conhecidos)
9. [Propostas de Melhorias](#9-propostas-de-melhorias)
10. [Referência Rápida para Debugging](#10-referência-rápida-para-debugging)

---

## 1. Visão Geral da Arquitetura

### 1.1 Estrutura de Arquivos da Engine

```
myzap/
├── engines/
│   ├── WhatsappWebJS.js        # 🔴 CORE - Classe principal da engine
│   └── helper/
│       └── wweb.js             # Helper para QR Code e opções do client
│
├── functions/WhatsappWebJS/
│   ├── mensagens.js            # Proxy para funções de mensagens
│   ├── auth.js                 # Proxy para funções de autenticação
│   └── helper/
│       ├── mensagens.js        # 🔴 IMPLEMENTAÇÃO - Todas as funções de mensagem
│       └── auth.js             # Implementação de validação de acesso
│
├── controllers/
│   ├── SessionsController.js   # Gerenciamento de sessões (API)
│   ├── EventsController.js     # Pipeline de processamento de eventos
│   ├── WebhooksController.js   # Envio de webhooks
│   └── helper/
│       ├── core/
│       │   └── sessions.js     # 🔴 CRÍTICO - Injeção e gerenciamento de clients
│       └── events/
│           ├── connectionStateManager.js  # Gerenciamento de estado
│           ├── socketWebhookManager.js    # Socket.IO + Webhooks
│           └── statusAckManager.js        # ACK de mensagens
│
├── jobs/
│   ├── sessionHealthCheck.js   # 🔴 CRÍTICO - Detecta sessões zumbi
│   └── sessionKeepAlive.js     # Reconexão automática
│
└── routers/
    └── WhatsappWebJS.js        # Rotas HTTP da API
```

### 1.2 Diagrama de Dependências

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              index.js                                    │
│                        (Inicialização do servidor)                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                             startup.js                                   │
│              startAllSessions() / startCleanupJobs()                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐  ┌──────────┐  ┌──────────────┐
            │ WhatsappWebJS│  │  Jobs    │  │   Routers    │
            │   Engine     │  │ (Health  │  │ (HTTP API)   │
            │              │  │  Check)  │  │              │
            └──────────────┘  └──────────┘  └──────────────┘
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────────────────────────────────────┐
            │         SessionsHelper (sessions.js)         │
            │      Mapa de clients em memória: {}          │
            └─────────────────────────────────────────────┘
                                    │
                                    ▼
            ┌─────────────────────────────────────────────┐
            │       whatsapp-web.js (biblioteca)           │
            │              Puppeteer/Chrome                │
            └─────────────────────────────────────────────┘
```

### 1.3 Fluxo de Dados Principal

```
[Requisição HTTP] 
       │
       ▼
[Router WhatsappWebJS.js] ──→ [Middleware checkParams/checkNumber]
       │
       ▼
[functions/WhatsappWebJS/helper/mensagens.js]
       │
       ▼
[SessionsHelper.getInjectedClient(session)] ──→ Retorna client do mapa
       │
       ▼
[client.sendMessage() / client.on()] ──→ whatsapp-web.js
       │
       ▼
[Puppeteer/Chrome] ◄──► [WhatsApp Web]
```

---

## 2. Fluxo de Inicialização

### 2.1 Sequência de Boot

```javascript
// 1. index.js - Servidor inicia
server.listen() → startAllSessions() → startCleanupJobs()

// 2. startup.js - Para cada device no banco
for (device of devices) {
  WhatsappWebJS.start(mockReq, mockRes, device.session)
  // IMPORTANTE: Não usa await - permite paralelismo
  await sleep(2000) // Delay entre sessões
}

// 3. WhatsappWebJS.start() - engines/WhatsappWebJS.js
- Cria/atualiza registro na tabela Device
- Configura client com LocalAuth
- Registra listeners (qr, ready, authenticated, disconnected)
- Chama client.initialize()
```

### 2.2 Fluxo Detalhado de WhatsappWebJS.start()

```
WhatsappWebJS.start(req, res, session)
│
├─► clearSessionTimeout(session)     // Limpa timeout anterior
│
├─► Device.upsert()                  // Cria/atualiza no banco
│       state: 'STARTING'
│       status: 'INITIALIZING'
│       attempts_start: +1
│
├─► new Client(clientOptions)        // Cria instância whatsapp-web.js
│       authStrategy: LocalAuth
│       dataPath: ./instances/{session}
│       puppeteer: { headless: true, args: [...] }
│
├─► client.on('qr')                  // Listener QR Code
│       └─► Gera base64
│       └─► Salva no banco (Device.qrCode)
│       └─► Emite Socket.IO
│       └─► Chama webhook wh_qrcode
│
├─► client.on('authenticated')       // Após escanear QR
│       └─► SessionsHelper.injectClient(session, client)  // 🔴 CRÍTICO
│       └─► Device.update(status: 'LOADING')
│
├─► client.on('ready')              // WhatsApp pronto
│       └─► clearTimeout()          // Cancela timeout de 10 min
│       └─► Device.update(status: 'CONNECTED')
│       └─► Resolve Promise
│
├─► client.on('disconnected')       // Desconexão
│       └─► Device.update(status: 'disconnected')
│       └─► Log de diagnóstico
│
└─► client.initialize()             // Inicia Puppeteer
```

### 2.3 Pontos de Injeção do Client

O client é injetado em `SessionsHelper.clients[session]` em dois momentos:

1. **Após `authenticated`** (linha 328 de WhatsappWebJS.js):
   ```javascript
   client.on('authenticated', () => {
     sessionHelper.injectClient(session, client);
   });
   ```

2. **Após `ready`** (via Sessions.addInfoSession):
   ```javascript
   Sessions.addInfoSession(session, { client });
   ```

**⚠️ ATENÇÃO:** Se o client não for injetado corretamente, todas as operações falharão com:
```
Cannot read properties of undefined (reading 'getChat')
```

---

## 3. Sistema de Autenticação

### 3.1 LocalAuth - Persistência de Sessão

```javascript
// engines/helper/wweb.js - getClientOptions()
authStrategy: new LocalAuth({ 
  clientId: '',                        // Sem prefixo
  dataPath: './instances/{session}'    // Pasta da sessão
})
```

**Estrutura da pasta de sessão:**
```
instances/
└── {session}/
    └── session/
        ├── Default/
        │   ├── Cookies
        │   ├── Cookies-journal      // 🔴 Pode causar EBUSY no Windows
        │   ├── Local Storage/
        │   └── Session Storage/
        └── ... (dados do Chrome)
```

### 3.2 Fluxo de QR Code

```
┌─────────────┐    ┌──────────────┐    ┌────────────────┐
│ client.on   │───►│ generateQR   │───►│ Socket.IO emit │
│   ('qr')    │    │ HooksAndEmit │    │  'qrcode'      │
└─────────────┘    └──────────────┘    └────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ Device.update│
                   │  qrCode:base64│
                   │  urlCode:text │
                   └──────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ wh_qrcode()  │
                   │  (webhook)   │
                   └──────────────┘
```

### 3.3 Reconexão Automática

A reconexão é gerenciada por dois sistemas:

1. **sessionKeepAlive.js** - Dispara `/start` para sessões elegíveis
2. **startSession** (mensagens.js) - Verifica estado e decide ação:

```javascript
// functions/WhatsappWebJS/helper/mensagens.js - startSession()

if (sessionExists && status === 'CONNECTED' && !isClientActive) {
  // Pasta existe, banco diz conectado, mas client morreu
  engine.start(req, res, session);  // Reconectar
}
```

---

## 4. Envio e Recebimento de Mensagens

### 4.1 Envio de Mensagens - Fluxo

```
POST /sendText
│
├─► checkParams (middleware)
│       └─► Valida session e sessionkey
│
├─► checkNumber (middleware)
│       └─► Formata número (55..@c.us)
│
├─► Mensagens.sendText (proxy)
│       └─► helper/mensagens.js
│
├─► Sessions.getSession(session)
│       └─► SessionsHelper.getInjectedClient(session)
│       └─► Retorna { client }
│
├─► buildNumber(req)
│       └─► Verifica cache
│       └─► Retorna number@c.us ou number@g.us
│
└─► client.sendMessage(number, text, { sendSeen: false })
        └─► whatsapp-web.js
        └─► Puppeteer
        └─► WhatsApp Web
```

### 4.2 Recebimento de Mensagens - Pipeline

```javascript
// controllers/EventsController.js

static async receiveMessage(session, client, req) {
  // WhatsApp-Web-JS usa client.on('message')
  client.on('message', async (message) => {
    registerMessageReceived(session);  // Health Check
    await this.processMessage(message, session, client, req);
  });
}

static async processMessage(message, session, client, req) {
  // 1. Construir contexto
  const ctx = await ContextBuilder.build({ message, session, client, req });
  
  // 2. Filtrar tipos não permitidos
  if (!eventsHelper.isPermitido(message)) return;
  
  // 3. Mensagem do próprio bot
  if (message.fromMe) {
    await OutboundMessageProcessor.processFromMe(...);
    return;
  }
  
  // 4. Notificar via webhook
  await socketManager.notifyMessageReceived(payload);
  
  // 5. Processar áudio (se IA ativa)
  await AudioProcessor.processAudio(...);
  
  // 6. Registrar histórico
  await ChatHistoryHelper.registerUserMessage(...);
  
  // 7. Engine de decisão IA
  await DecisionEngine.process(...);
}
```

### 4.3 Tipos de Mensagens Suportados

| Tipo | Endpoint | Função |
|------|----------|--------|
| Texto | `/sendText` | `sendText()` |
| Imagem | `/sendImage` | `sendMedia('image')` |
| Vídeo | `/sendVideo` | `sendMedia('video')` |
| Áudio | `/sendAudio` | `sendMedia('audio')` |
| Arquivo | `/sendFile` | `sendMedia('file')` |
| Base64 | `/sendFile64` | `sendFile64()` |
| Sticker | `/sendSticker` | `sendMedia('sticker')` |
| Localização | `/sendLocation` | `sendLocation()` |
| Contato | `/sendContact` | `sendContact()` |
| Enquete | `/sendPoll` | `sendPollMessage()` |
| Reação | `/reaction` | `sendReactionToMessage()` |

**⚠️ DEPRECIADO:** `sendListMessage` - Não funciona mais no WhatsApp.

---

## 5. Sistema de Eventos e Listeners

### 5.1 Eventos do whatsapp-web.js

```javascript
// engines/WhatsappWebJS.js

// ─────────── AUTENTICAÇÃO ───────────
client.on('qr', (qr) => {...})
client.on('authenticated', (sessionData) => {...})
client.on('auth_failure', (msg) => {...})
client.on('loading_screen', (percent, message) => {...})

// ─────────── CONEXÃO ───────────
client.on('ready', () => {...})
client.on('disconnected', (reason) => {...})
client.on('change_state', (state) => {...})

// ─────────── MENSAGENS ───────────
client.on('message', (message) => {...})           // Recebidas
client.on('message_create', (message) => {...})    // Todas (enviadas + recebidas)
client.on('message_ack', (message, ack) => {...})  // Confirmação
client.on('message_revoke_everyone', (...) => {...})
client.on('message_revoke_me', (...) => {...})

// ─────────── OUTROS ───────────
client.on('change_battery', (batteryInfo) => {...})
client.on('media_uploaded', (...) => {...})
client.on('group_update', (...) => {...})
```

### 5.2 Estados de Conexão

| Estado | Significado | Ação |
|--------|-------------|------|
| `OPENING` | Abrindo navegador | Aguardar |
| `PAIRING` | Lendo QR Code | Aguardar escaneamento |
| `CONNECTED` | Conectado | Normal |
| `CONFLICT` | Outro dispositivo | `client.useHere()` |
| `UNPAIRED` | Removido do celular | Remover sessão |
| `TIMEOUT` | Timeout de conexão | Reiniciar watchdog |
| `ZOMBIE` | Detectado pelo Health Check | Destruir e recriar |

### 5.3 Integração com Socket.IO

```javascript
// index.js - Configuração
const io = require("socket.io")(server, { cors: {...} });

// Middleware injeta io em todas as requisições
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Eventos emitidos:
io.emit('qrcode', { qrCode, session, state: 'QRCODE' });
io.emit('whatsapp-status', true/false);
io.emit(`qrcode-${session}`, {...});  // Canal específico
```

---

## 6. Webhooks

### 6.1 Tipos de Webhooks

| Webhook | Campo no Device | Disparado quando |
|---------|-----------------|------------------|
| `wh_qrcode` | `wh_qrcode` | QR Code gerado |
| `wh_connect` | `wh_connect` | Status de conexão muda |
| `wh_status` | `wh_status` | Status genérico |
| `wh_message` | `wh_message` | Mensagem recebida |

### 6.2 Fluxo de Webhook

```javascript
// controllers/WebhooksController.js

static async wh_messages(session, response) {
  const conn = await Sessions.getClient(session);
  if (conn?.wh_message) {
    await helper.send(conn.wh_message, response, 'messages');
  }
}
```

---

## 7. Jobs e Manutenção Automática

### 7.1 Session Health Check (CRÍTICO)

**Arquivo:** `jobs/sessionHealthCheck.js`

**Função:** Detecta sessões "zumbi" - aparentemente conectadas mas não respondem.

```javascript
// Configurações
HEALTH_CHECK_INTERVAL_MS = 30000    // A cada 30 segundos
ZOMBIE_THRESHOLD_MINUTES = 15       // 15 min sem mensagens = alerta
MAX_CONSECUTIVE_FAILURES = 2        // 2 falhas = zumbi

// Verificações realizadas:
1. client.getState()          // Deve retornar 'CONNECTED'
2. client.pupPage.evaluate()  // Página Puppeteer responde?
3. Tempo desde última mensagem
```

**Ações quando detecta zumbi:**

```javascript
if (isDetachedFrame) {
  // Frame detached = irrecuperável
  await client.destroy();
  SessionsHelper.removeClientFromMemory(session);
  Device.update({ state: 'disconnected' });
} else {
  // Tentar refresh
  await client.pupPage.reload();
}
```

### 7.2 Session Keep-Alive

**Arquivo:** `jobs/sessionKeepAlive.js`

**Função:** Reconecta sessões que caíram.

```javascript
// Sessões elegíveis:
- Status: DISCONNECTED, TIMEOUT, notLogged
- attempts_start < MAX_START_ATTEMPTS (10)
- Não está aguardando QR (qrCode, INITIALIZING, STARTING)
- Passou mais de 10 minutos desde last_start

// Ação:
POST /start (via axios interno)
```

### 7.3 Outros Jobs

| Job | Intervalo | Função |
|-----|-----------|--------|
| memoryMonitor | 5 min | Monitora heap/RSS |
| dailyReport | 1x/dia | Email com métricas |
| cacheCleanup | 1 hora | Limpa cache antigo |
| logsCleanup | 1 hora | Remove logs > 7 dias |
| databaseCleanup | 1 hora | Limpa registros antigos |
| instancesCleanup | 1 hora | Remove pastas órfãs |
| chatHistoryCleanup | 1 hora | Limpa histórico de chat |

---

## 8. Pontos Críticos e Problemas Conhecidos

### 8.1 🔴 Erros que Indicam Atualização Necessária da Biblioteca

| Erro | Causa | Solução |
|------|-------|---------|
| `Attempted to use detached Frame` | Página Puppeteer perdida | `pnpm update whatsapp-web.js` |
| `Execution context was destroyed` | Navegação inesperada | Atualizar biblioteca |
| `Protocol error (Runtime.callFunctionOn)` | CDP desconectado | Atualizar + verificar Chrome |
| `The browser is already running` | Sessão duplicada | Matar processos Chrome órfãos |

### 8.2 🔴 Sessões Zumbi

**Sintomas:**
- Status `CONNECTED` no banco
- `client.getState()` retorna `CONNECTED`
- Mas mensagens não são recebidas

**Causa:** O WhatsApp Web pode desconectar silenciosamente.

**Solução implementada:** Health Check a cada 30s verifica:
1. Se `pupPage.evaluate()` responde
2. Se recebeu mensagem nos últimos 15 min

### 8.3 🔴 Conflito de Browser Running

**Erro:**
```
The browser is already running for /var/www/myzap/instances/{session}/session
```

**Causa:** Processo Chrome anterior não foi encerrado.

**Soluções:**
1. `pkill -f "chrome.*{session}"` (manual)
2. Health Check destrói client corretamente
3. Aguardar timeout de 10 min

### 8.4 🔴 Injeção de Client Falha

**Erro:**
```
Cannot read properties of undefined (reading 'getChat')
```

**Causa:** `SessionsHelper.clients[session]` está vazio.

**Verificações:**
1. Evento `authenticated` foi disparado?
2. `injectClient()` foi chamado?
3. Sessão está realmente conectada?

### 8.5 🟡 Timeout de Inicialização

**Configuração atual:** 10 minutos

**Se expirar:**
1. Client é destruído
2. Device atualizado para `TIMEOUT`
3. Keep-Alive tentará novamente após 10 min

### 8.6 🟡 QR Code Expira Rápido

**Tempo de vida:** ~20 segundos (definido pelo WhatsApp)

**Mitigação:**
- `qrMaxRetries: 5` - 5 tentativas de QR
- `authTimeoutMs: 120000` - 2 min total

### 8.7 🟡 webVersionCache

**Problema:** WhatsApp Web atualiza constantemente, quebrando sessões.

**Solução implementada:**
```javascript
webVersionCache: {
  type: 'remote',
  remotePath: 'https://raw.githubusercontent.com/.../cache.html'
}
```

**⚠️ ATENÇÃO:** Se esse cache externo ficar desatualizado, TODAS as sessões podem falhar.

---

## 9. Propostas de Melhorias

### 9.1 Melhorar Detecção de Sessões Zumbi

```javascript
// PROPOSTA: Heartbeat ativo em vez de passivo
async function sendHeartbeat(session, client) {
  try {
    // Enviar mensagem para si mesmo como teste
    const info = await client.info;
    await client.sendMessage(`${info.wid.user}@c.us`, '🤖 heartbeat', { sendSeen: false });
    return true;
  } catch (e) {
    return false; // Sessão morta
  }
}
```

### 9.2 Circuit Breaker para Reconexão

```javascript
// PROPOSTA: Parar de tentar após N falhas em X tempo
const circuitBreaker = {
  failures: 0,
  lastFailure: null,
  isOpen: false,
  
  recordFailure() {
    this.failures++;
    this.lastFailure = Date.now();
    if (this.failures >= 5) this.isOpen = true;
  },
  
  canTry() {
    if (!this.isOpen) return true;
    // Resetar após 30 minutos
    if (Date.now() - this.lastFailure > 30 * 60 * 1000) {
      this.isOpen = false;
      this.failures = 0;
    }
    return !this.isOpen;
  }
};
```

### 9.3 Fallback de webVersionCache

```javascript
// PROPOSTA: Lista de caches alternativos
const WEB_VERSION_CACHES = [
  'https://raw.githubusercontent.com/AliAryanTech/cache/...',
  'https://raw.githubusercontent.com/AnotherMaintainer/cache/...',
  'https://raw.githubusercontent.com/project-backup/cache/...'
];

async function getWorkingCache() {
  for (const url of WEB_VERSION_CACHES) {
    if (await isUrlAccessible(url)) return url;
  }
  return null; // Nenhum disponível
}
```

### 9.4 Métricas por Sessão

```javascript
// PROPOSTA: Coletar métricas específicas
const sessionMetrics = {
  messagesSent: 0,
  messagesReceived: 0,
  lastActivity: Date.now(),
  reconnects: 0,
  errors: []
};
```

### 9.5 Documentação de Eventos

```javascript
// PROPOSTA: Wrapper com logging automático
function wrapEvent(client, eventName, handler) {
  client.on(eventName, async (...args) => {
    customLogger.debug(`[EVENT] ${eventName}`, args);
    try {
      await handler(...args);
    } catch (e) {
      customLogger.error(`[EVENT ERROR] ${eventName}`, e);
    }
  });
}
```

---

## 10. Referência Rápida para Debugging

### 10.1 Comandos Úteis

```bash
# Verificar versão da biblioteca
pnpm list whatsapp-web.js

# Atualizar biblioteca (SOLUÇÃO COMUM)
pnpm update whatsapp-web.js

# Verificar processos Chrome órfãos
ps aux | grep chrome | grep myzap

# Matar todos os Chrome do MyZap
pkill -f "chrome.*myzap"

# Verificar logs de erro
tail -f logs/$(date +%Y-%m-%d)/erro.log

# Status das sessões no banco
sqlite3 database.sqlite "SELECT session, status, state, attempts_start FROM devices"
```

### 10.2 Checklist de Debugging

```
□ 1. Sessão desconectando?
    → pnpm update whatsapp-web.js
    
□ 2. QR Code não aparece?
    → Verificar pasta instances/{session}
    → Remover pasta e tentar novamente
    
□ 3. Erro "Cannot read properties of undefined"?
    → Verificar se client foi injetado
    → GET /health/sessions para ver status real
    
□ 4. Erro "browser is already running"?
    → pkill -f "chrome.*{session}"
    → Aguardar 10 min (timeout)
    
□ 5. Sessão conecta e desconecta em loop?
    → Verificar attempts_start no banco
    → Pode ter atingido limite (10)
    → Resetar: UPDATE devices SET attempts_start=0 WHERE session='xxx'
```

### 10.3 Verificar Estado Real da Sessão

```javascript
// Via API
GET /health/sessions
// Retorna status de todas as sessões

POST /verifyRealStatus
{ "session": "xxx" }
// Verifica estado REAL no Puppeteer
```

### 10.4 Logs Importantes

```
[🧟 ZOMBIE DETECTED]    → Sessão não responde
[AUTO-RECONNECT]        → Tentando reviver sessão
[DISCONNECT ANALYSIS]   → Diagnóstico de desconexão
[⚠️ LOGOUT IMEDIATO]    → Desconexão < 10s após conectar
[STATE CHANGE]          → Mudança de estado da conexão
```

---

## Apêndice A: Diagrama de Estados

```
                    ┌───────────────┐
                    │   STARTING    │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
              ┌─────│ INITIALIZING  │
              │     └───────┬───────┘
              │             │
              │             ▼
              │     ┌───────────────┐
              │     │    QRCODE     │◄─────────────┐
              │     └───────┬───────┘              │
              │             │                      │
              │             │ (escaneou)           │
              │             ▼                      │
              │     ┌───────────────┐              │
              │     │ AUTHENTICATED │              │
              │     └───────┬───────┘              │
              │             │                      │
              │             ▼                      │
              │     ┌───────────────┐              │
              └────►│   CONNECTED   │◄────────┐    │
                    └───────┬───────┘         │    │
                            │                 │    │
        ┌───────────────────┼─────────────────┤    │
        │                   │                 │    │
        ▼                   ▼                 │    │
┌───────────────┐   ┌───────────────┐         │    │
│    TIMEOUT    │   │ DISCONNECTED  │─────────┘    │
└───────┬───────┘   └───────┬───────┘              │
        │                   │                      │
        └───────────────────┴──────────────────────┘
                   (keep-alive reconecta)
```

---

## Apêndice B: Configurações Importantes

```javascript
// engines/helper/wweb.js - getClientOptions()

puppeteer: {
  headless: true,
  timeout: 120000,              // 2 min
  protocolTimeout: 300000,      // 5 min (CRÍTICO)
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--js-flags=--max-old-space-size=512'  // Limite memória V8
  ]
},
qrMaxRetries: 5,
authTimeoutMs: 120000,
webVersionCache: {
  type: 'remote',
  remotePath: '...'
}
```

---

**📝 Este documento deve ser atualizado sempre que:**
- A biblioteca whatsapp-web.js for atualizada
- Novos problemas forem identificados
- Melhorias forem implementadas
- Comportamentos mudarem

---

*Documento gerado para o projeto MyZap - Engine WhatsApp-Web-JS*
