# 📝 Changelog

Todas as mudanças notáveis neste fork serão documentadas neste arquivo.

---

## [3.0.19] - 2026-09-06

### ✨ Anexos na mensagem padrão

- A mensagem padrão do primeiro contato pode vir acompanhada de fotos ou PDF
  (cardápio, promoção) configurados no painel do ClickExpress. O myzap busca a
  lista em `GET /myzap/anexos-padrao/{sessionkey}` na hora de mandar (cache de
  60 s) e só envia com a loja aberta — a API é quem decide "aberto".
- `messageSender.sendFileFromUrl`: imagem vai como foto, PDF como documento
  (webjs, wppconnect e venom).
- Um anexo que falhar não segura os outros nem o texto.
- `npm test` roda o smoke da IA e o teste dos anexos (`test/anexos-padrao.js`).

## [2.0.0] - 2025-11-16

### 🎉 Fork Inicial - JZ-TECH-SYS

Este é o primeiro release oficial do fork **JZ-TECH-SYS/myzap** baseado no projeto original [billbarsch/myzap](https://github.com/billbarsch/myzap).

### ✨ Novas Funcionalidades

#### 🤖 Sistema de Inteligência Artificial
- ✅ Integração completa com OpenAI GPT-4
- ✅ Sistema de Prompts personalizados por empresa
- ✅ RAG (Retrieval-Augmented Generation) com Vector Stores
- ✅ Transcrição automática de mensagens de áudio
- ✅ Histórico inteligente de conversas (últimas 20 mensagens)
- ✅ Sistema de Guards para controle fino de quando a IA responde
- ✅ Detecção automática de pedido de atendimento humano
- ✅ Pausa automática da IA quando humano assume conversa

#### 🎯 Sistema de Guards (Validações Inteligentes)
- ✅ `checkGroupMessage`: Bloqueia respostas automáticas em grupos
- ✅ `checkCompanyEnabled`: Valida empresa configurada
- ✅ `checkIaEnabled`: Verifica se IA está ativa
- ✅ `checkHumanRequest`: Detecta pedidos de atendimento humano
- ✅ `checkRecentHuman`: Pausa IA se humano falou recentemente (10min)
- ✅ `checkClientRequestedHuman`: Cliente solicitou humano explicitamente

#### 📊 Dashboard Administrativo
- ✅ Interface web completa em `/admin/ia-manager`
- ✅ Gerenciamento visual de sessões
- ✅ Ativação/desativação de IA por sessão
- ✅ Configuração de prompts e vectors
- ✅ Monitoramento de status de sessões
- ✅ Edição inline de configurações

#### 🛡️ Validação de Números
- ✅ Verificação robusta se número existe no WhatsApp antes de enviar
- ✅ Tentativa automática com/sem 9º dígito (números brasileiros)
- ✅ Cache de números validados para performance
- ✅ Evita números fantasma e erros de envio

#### ⚡ Otimizações de Performance
- ✅ Argumentos otimizados do Chrome (reduz 30-40% RAM)
- ✅ Limits SQL em consultas (reduz 50-70% memória)
- ✅ Sistema de cache inteligente
- ✅ Jobs de limpeza automática:
  - Cache Cleanup (6h)
  - Chat History Cleanup (24h)
  - Database Cleanup (24h)
  - Instances Cleanup (1h)
  - Logs Cleanup (24h)
  - Memory Monitor (15min)

#### 📝 Sistema de Histórico
- ✅ Modelo `ChatHistory` com campos otimizados
- ✅ Registro de mensagens do usuário e assistente
- ✅ Suporte a diferentes tipos de mensagem (text, audio, ia, transferencia_humano)
- ✅ Limpeza automática de mensagens antigas (>30 dias)
- ✅ Consultas otimizadas com limit

#### 🔧 Melhorias Técnicas
- ✅ Logger padronizado (`customLogger`) em todo projeto
- ✅ Middleware `checkNumber` robusto
- ✅ Adapter unificado `messageSender` para 3 engines
- ✅ Sistema de eventos modularizado
- ✅ Migrations organizadas
- ✅ Documentação inline completa

### 🔄 Mudanças

#### Estrutura de Arquivos
```
controllers/helper/ia/          # Novo diretório de IA
  ├── audioProcessor.js         # Processamento de áudio
  ├── contextBuilder.js         # Construção de contexto
  ├── decisionEngine.js         # Engine de decisão principal
  ├── defaultMessageService.js  # Serviço de mensagem padrão
  ├── empresaIA.js              # Integração OpenAI
  ├── guards.js                 # Sistema de Guards
  ├── humanDetector.js          # Detecção de pedido humano
  └── iaConfig.js               # Configurações da IA

controllers/helper/events/      # Eventos modernizados
  ├── messageSender.js          # Adapter unificado
  ├── chatHistory.js            # Gerenciamento de histórico
  ├── events.js                 # Pipeline de eventos
  └── triggers.js               # Sistema de triggers

jobs/                           # Jobs de manutenção
  ├── cacheCleanup.js
  ├── chatHistoryCleanup.js
  ├── databaseCleanup.js
  ├── instancesCleanup.js
  ├── logsCleanup.js
  └── memoryMonitor.js

Models/                         # Novos modelos
  ├── chatHistory.js
  ├── deviceCompany.js
  └── tokenUsage.js

Views/pages/admin/              # Interface administrativa
  └── ia-manager.ejs
```

#### Engines Otimizadas
- ✅ `engines/helper/wweb.js` - Argumentos Chrome otimizados
- ✅ `engines/helper/stealth.js` - Stealth mode melhorado
- ✅ `engines/helper/vn.js` - Venom otimizado

#### Middlewares
- ✅ `checkNumber.js` - Validação completa de números
- ✅ `checkAuthMiddleware.js` - Autenticação aprimorada

### 🐛 Correções

- ✅ Corrigido problema de `isGroupMsg` undefined no whatsapp-web.js
- ✅ Corrigido validação de números brasileiros com/sem 9º dígito
- ✅ Corrigido cache salvando números incorretos
- ✅ Corrigido detecção de grupos por sufixo `@g.us`
- ✅ Corrigido memory leaks em consultas SQL sem limit
- ✅ Corrigido logs excessivos ocupando disco

### 📚 Documentação

- ✅ README.md completamente reescrito
- ✅ CHANGELOG.md criado
- ✅ Documentação inline em todos os módulos
- ✅ Créditos ao projeto original preservados
- ✅ Guia completo de instalação e configuração

### 🎯 Melhorias de UX

- ✅ Dashboard intuitivo para gerenciamento
- ✅ Feedback visual de status das sessões
- ✅ Mensagens de erro mais claras
- ✅ Logs estruturados e padronizados

### ⚙️ Configurações

#### Novas Variáveis de Ambiente
```env
OPENAI_API_KEY=sk-proj-xxxxx  # Chave da API OpenAI
NODE_ENV=production            # Ambiente de execução
```

#### Configurações de IA (`iaConfig.js`)
```javascript
IA_COOLDOWN_SECONDS: 0         # Cooldown entre respostas (0 = sem cooldown)
HUMAN_PAUSE_MINUTES: 10        # Pausa após humano falar (10min)
TEMPO_MENSAGEM_PADRAO_DEFAULT: 30  # Cooldown mensagem padrão (30min)
ACEITAR_AUDIO: true            # Aceitar mensagens de áudio
MAX_AUDIO_SIZE: 25MB           # Tamanho máximo de áudio
MAX_AUDIO_DURATION: 90         # Duração máxima (segundos)
```

### 📊 Impacto das Otimizações

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| RAM/sessão | 500-850 MB | 300-450 MB | **-40-50%** |
| SWAP | 1.9 GB | 0-200 MB | **-90%** |
| Disco | 2.5 GB | 1.3-1.7 GB | **-800 MB** |
| Queries SQL | Ilimitadas | Max 50 | **-70% RAM** |
| Histórico IA | Todas msgs | 20 msgs | **+Contexto** |

### 🔐 Segurança

- ✅ Validação de números antes do envio
- ✅ Sanitização de mensagens padrão
- ✅ Autenticação por sessionkey
- ✅ Logs estruturados para auditoria

### 🚀 Performance

- ✅ Cache de números validados
- ✅ Consultas SQL otimizadas com indexes
- ✅ Limpeza automática de dados antigos
- ✅ Monitoramento de memória em tempo real

---

## Próximas Versões (Roadmap)

### [2.1.0] - Em Planejamento
- [ ] Suporte a múltiplos provedores de IA (Anthropic, Gemini)
- [ ] Sistema de filas com Bull para melhor escalabilidade
- [ ] Webhooks customizáveis por evento
- [ ] API de analytics e métricas
- [ ] Suporte a mensagens agendadas
- [ ] Sistema de templates de mensagem

### [2.2.0] - Futuro
- [ ] Interface de chat em tempo real
- [ ] Suporte a chatbots com fluxos visuais
- [ ] Integração com CRM populares
- [ ] Sistema de tags e categorização de conversas
- [ ] Relatórios avançados de uso

---

## 🙏 Créditos

Este fork é baseado no excelente trabalho de:

- **Bill Barsch** - [billbarsch/myzap](https://github.com/billbarsch/myzap)
- **Eduardo Policarpo** - Desenvolvedor 2.0
- **Jonathan Henrique** - Desenvolvedor 3.0

**Fork mantido por:** [JZ-TECH-SYS](https://github.com/JZ-TECH-SYS)

---

## 📝 Formato

Este changelog segue o formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

### Tipos de mudanças:
- **✨ Novas Funcionalidades**: Novas features
- **🔄 Mudanças**: Alterações em funcionalidades existentes
- **🐛 Correções**: Bug fixes
- **🗑️ Removido**: Funcionalidades removidas
- **⚠️ Descontinuado**: Funcionalidades que serão removidas
- **🔐 Segurança**: Correções de segurança
