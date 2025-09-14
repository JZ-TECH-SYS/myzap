# 📋 Sistema de Logs - MyZap

## 🎯 Configuração de Logs Separados

O sistema agora possui logs organizados para melhor debugging e monitoramento.

### 📁 Arquivos de Log (pasta `/logs`)

- **`app.log`** - Logs gerais da aplicação (INFO, SUCCESS, WARNING)
- **`error.log`** - Apenas erros da aplicação
- **`debug.log`** - Logs de debug detalhados
- **`database.log`** - Queries do banco de dados (Sequelize)
- **`whatsapp.log`** - Logs específicos do WhatsApp (engines)

### ⚙️ Configuração (.env)

```bash
# Mostrar queries do banco no console (true/false)
DEBUG_SQL=false

# Nível de log no console (DEBUG, INFO, WARNING, ERROR)
LOG_LEVEL=INFO
```

### 🎮 Controle de Exibição no Console

| Tipo | Console | Arquivo | Condição |
|------|---------|---------|----------|
| **ERROR** | ✅ Sempre | error.log | Sempre mostrado |
| **WARNING** | ✅ Se LOG_LEVEL >= WARNING | app.log | - |
| **INFO** | ✅ Se LOG_LEVEL >= INFO | app.log | - |
| **DEBUG** | ✅ Se LOG_LEVEL = DEBUG | debug.log | - |
| **DATABASE** | ⚠️ Apenas se DEBUG_SQL=true | database.log | Não polui console |
| **WHATSAPP** | ✅ Se LOG_LEVEL >= INFO | whatsapp.log | Engine específico |

### 💡 Exemplos de Uso

```javascript
const customLogger = require('./util/customLogger');

// Logs da aplicação
customLogger.info('Servidor iniciado');
customLogger.success('Sessão conectada');
customLogger.warning('QR Code expirando');
customLogger.error('Falha na conexão');

// Logs específicos
customLogger.whatsapp('WhatsApp conectado');
customLogger.debug('Detalhes internos');
```

### 🔧 Configurações Recomendadas

**Desenvolvimento:**
```bash
DEBUG_SQL=false  # Para não poluir console
LOG_LEVEL=INFO   # Mostrar informações importantes
```

**Produção:**
```bash
DEBUG_SQL=false  # Nunca mostrar SQL em produção
LOG_LEVEL=WARNING # Apenas warnings e erros no console
```

**Debug Intensivo:**
```bash
DEBUG_SQL=true   # Mostrar queries para debug
LOG_LEVEL=DEBUG  # Mostrar tudo no console
```

### 📊 Benefícios

✅ **Console limpo** - Apenas logs relevantes da aplicação
✅ **Arquivos organizados** - Cada tipo em seu arquivo
✅ **Debug flexível** - Liga/desliga SQL queries facilmente
✅ **Cores no terminal** - Melhor visualização
✅ **Histórico completo** - Tudo salvo em arquivos
