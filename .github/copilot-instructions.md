# Instruções do GitHub Copilot - MyZap API

## 📋 Visão Geral do Projeto

MyZap é uma API multi-engine para WhatsApp que suporta **3 engines diferentes**:
- **WhatsappWebJS** (`whatsapp-web.js`) - Engine principal
- **WppConnect** (`@wppconnect-team/wppconnect`)
- **Venom** (`venom-bot`)

A engine ativa é definida em `config.js` → `config.engine`.

---

## 🏗️ Arquitetura do Projeto

```
myzap/
├── engines/           # Implementações das 3 engines WhatsApp
│   ├── WhatsappWebJS.js
│   ├── WppConnect.js
│   ├── Venom.js
│   └── helper/
├── functions/         # Funções específicas de cada engine
│   ├── WhatsappWebJS/
│   ├── WPPConnect/
│   └── Venom/
├── jobs/              # Tarefas agendadas (setInterval, NÃO node-cron)
├── services/          # Serviços (email, IA, webhooks)
├── controllers/       # Controladores das rotas
├── routers/           # Rotas da API
├── Models/            # Modelos Sequelize (SQLite)
├── middlewares/       # Middlewares de autenticação e validação
├── migrations/        # Migrações do banco de dados
├── util/              # Utilitários (logger, helpers)
├── config/            # Arquivos de configuração JSON
├── instances/         # Dados das sessões WhatsApp
└── logs/              # Logs diários organizados por data
```

---

## ⚠️ REGRA DE OURO PARA DEBUGGING

### Quando houver problemas de conexão/sessão:

**SEMPRE verifique primeiro se houve atualização nas bibliotecas das engines!**

```bash
# Verificar versão atual vs disponível
pnpm outdated whatsapp-web.js
pnpm outdated @wppconnect-team/wppconnect  
pnpm outdated venom-bot
```

As engines WhatsApp dependem de engenharia reversa do WhatsApp Web e **quebram frequentemente** com atualizações do WhatsApp. Sintomas comuns:
- Sessões desconectando após scan do QR
- QR code não aparece
- Mensagens não enviando
- Timeouts inexplicáveis

**Solução típica:** `pnpm update whatsapp-web.js` (ou a engine em uso)

---

## 🔧 Configurações Importantes

### config.js
```javascript
config.engine = 'WhatsappWebJS'  // Engine ativa: WhatsappWebJS | WppConnect | Venom
config.session_keepalive_enabled = true
config.session_keepalive_interval_ms = 300000  // 5 minutos
```

### PM2 (ecosystem.config.js)
- `--max-old-space-size=1024` (heap de 1GB)
- `max_memory_restart: '1G'`
- Modo cluster desabilitado (WhatsApp não suporta)

### Banco de Dados
- **SQLite** com Sequelize ORM
- Arquivo: definido em `config/config.json`
- Modelos em `Models/`

---

## 📧 Sistema de Email

### API: MailJZTech
- Endpoint: `https://api-mail.jztech.com.br/enviar-email`
- Variáveis: `EMAIL_TOKEN`, `EMAIL_DESTINATION`, `EMAIL_CC`

### Regras do Email:
1. **SEMPRE** incluir `nome_remetente` no payload
2. **NUNCA** usar emojis no `assunto` (causa rejeição SMTP)
3. Emojis no corpo HTML devem usar **HTML entities** (ex: `&#128994;` para 🟢)
4. Campo `corpo_texto` não é necessário se `corpo_html` estiver presente

---

## ⏰ Sistema de Jobs

**IMPORTANTE:** Todos os jobs usam `setInterval` nativo, **NÃO** usam `node-cron`.

| Job | Arquivo | Função |
|-----|---------|--------|
| Memory Monitor | `jobs/memoryMonitor.js` | Monitora uso de memória |
| Session Keep-Alive | `jobs/sessionKeepAlive.js` | Mantém sessões ativas |
| Daily Report | `jobs/dailyReport.js` | Email diário com métricas |
| Instance Metrics | `jobs/instanceMetrics.js` | Coleta métricas das instâncias |
| Cache Cleanup | `jobs/cacheCleanup.js` | Limpa cache antigo |
| Logs Cleanup | `jobs/logsCleanup.js` | Remove logs antigos |
| Database Cleanup | `jobs/databaseCleanup.js` | Limpa dados antigos do DB |
| Instances Cleanup | `jobs/instancesCleanup.js` | Remove instâncias órfãs |
| Chat History Cleanup | `jobs/chatHistoryCleanup.js` | Limpa histórico de chat |

### Inicialização
Todos os jobs são iniciados em `startup.js` → `initializeJobs()`.

---

## 🔌 Engines WhatsApp

### Estrutura de cada Engine
Cada arquivo em `engines/` exporta funções como:
- `start(session, options)` - Inicia sessão
- `close(session)` - Fecha sessão
- `getQRCode(session)` - Obtém QR code
- `sendMessage(session, number, message)` - Envia mensagem

### Funções específicas
As funções de cada engine ficam em `functions/{EngineName}/`:
- `sendText.js`, `sendImage.js`, `sendFile.js`, etc.

### Troca de Engine
Para trocar a engine, altere `config.engine` em `config.js` e reinicie.

---

## 🐛 Problemas Comuns e Soluções

### 1. Sessão desconecta após QR scan
- **Causa provável:** Atualização da biblioteca da engine
- **Solução:** `pnpm update whatsapp-web.js` (ou engine em uso)

### 2. Emails não chegam
- Verificar `nome_remetente` no payload
- Remover emojis do `assunto`
- Verificar `EMAIL_TOKEN` e `EMAIL_DESTINATION`

### 3. Memória alta / OOM
- Verificar `ecosystem.config.js` tem `--max-old-space-size=1024`
- Verificar jobs de cleanup estão rodando
- Considerar reinício automático via PM2

### 4. QR code não aparece
- Limpar pasta `instances/{session}/`
- Verificar se porta não está em uso
- Verificar logs em `logs/{data}/`

### 5. Heap mostrando valor errado
- Use `v8.getHeapStatistics().heap_size_limit` para heap limit real
- `process.memoryUsage().heapTotal` mostra apenas heap alocado atual

---

## 📊 Métricas e Monitoramento

### Memória (v8)
```javascript
const v8 = require('v8');
const heapStats = v8.getHeapStatistics();
// heapStats.heap_size_limit = limite real do heap
// heapStats.used_heap_size = heap em uso
```

### Planejamento de Capacidade
```
Sessões suportadas = (RAM disponível - 500MB) / 150MB por sessão
```

Para 31GB RAM: ~200 sessões teóricas (recomendado: 150 máximo).

---

## 🚀 Deploy e Produção

### Estrutura VPS
- **OS:** AlmaLinux 9 (RHEL-based)
- **Process Manager:** PM2
- **Caminho:** `/var/www/myzap`

### Comandos úteis
```bash
pm2 restart myzap
pm2 logs myzap
pm2 monit
```

### GitHub Actions
Deploy automático configurado em `.github/workflows/deploy.yml`.

---

## 📝 Convenções de Código

### Logging
Usar o logger customizado em `util/logger.js`:
```javascript
const logger = require('./util/logger');
logger.info('Mensagem', { dados });
logger.error('Erro', { error });
```

### Nomenclatura
- Controllers: `PascalCase` + `Controller.js`
- Models: `camelCase.js`
- Jobs: `camelCase.js`
- Routers: `PascalCase.js`

### Async/Await
Preferir async/await sobre callbacks ou .then().

---

## 🔐 Autenticação

### Middlewares
- `authMiddleware.js` - JWT para rotas protegidas
- `checkAPITokenMiddleware.js` - Validação de token da API
- `checkAuthMiddleware.js` - Verificação de sessão

### 2FA
Implementado para usuários admin via `twoFactorSecret` no modelo User.

---

## 📚 Referências Rápidas

### Variáveis de Ambiente Importantes
- `EMAIL_TOKEN` - Token da API de email
- `EMAIL_DESTINATION` - Email de destino para alertas
- `EMAIL_CC` - Cópia de email (opcional)
- `JWT_SECRET` - Segredo para tokens JWT
- `API_TOKEN` - Token da API principal

### Arquivos de Configuração
- `config.js` - Configurações principais da aplicação
- `config/config.json` - Configuração do Sequelize/banco
- `ecosystem.config.js` - Configuração do PM2
- `nodemon.json` - Configuração do nodemon (dev)
