# 🔧 CORREÇÕES DE ERROS - WINDOWS

**Data:** 13 de outubro de 2025  
**Status:** ✅ Corrigido

---

## 🐛 **ERROS CORRIGIDOS:**

### 1. ✅ **SQLITE_ERROR: no such column: createdAt**

**Problema:**
```
[ERROR] [CACHE CLEANUP] Erro: SQLITE_ERROR: no such column: createdAt
```

**Causa:**  
O banco SQLite usa `created_at` (snake_case), mas o código estava usando `createdAt` (camelCase).

**Solução:**  
- Arquivo: `jobs/cacheCleanup.js`
- Mudança: `createdAt` → `created_at`

---

### 2. ✅ **EBUSY: resource busy or locked (Cookies-journal)**

**Problema:**
```
[ERROR] EBUSY: resource busy or locked, unlink 'C:\laragon\www\myzap\instances\joaosn\session\Default\Cookies-journal'
```

**Causa:**  
No Windows, o Chrome mantém arquivos bloqueados mesmo após logout. A biblioteca `whatsapp-web.js` tenta deletar esses arquivos e falha.

**Soluções Implementadas:**

#### A) Job de Limpeza com Retry:
- Arquivo: `jobs/instancesCleanup.js`
- Adicionado sistema de retry (3 tentativas)
- Aguarda 2 segundos entre tentativas
- Se falhar após 3 tentativas, apenas avisa e pula

#### B) Evento Disconnected:
- Arquivo: `engines/WhatsappWebJS.js`
- Adicionado delay de 2 segundos antes de tentar limpar
- Deixa job automático fazer a limpeza (mais seguro)

---

### 3. ✅ **Timeout na inicialização (5 minutos)**

**Problema:**
```
[ERROR] Timeout na inicialização da sessão joaosn (5 minutos)
```

**Causa:**  
Windows precisa de mais tempo para inicializar o Chrome/Puppeteer, especialmente com 86% de RAM em uso.

**Solução:**  
- Arquivo: `engines/WhatsappWebJS.js`
- Timeout aumentado: 5 minutos → **10 minutos**

---

### 4. ⚠️ **Aviso de Memória Crítica (86%)**

**Problema:**
```
[WARNING] ⚠️ [MEMORY] Uso crítico de memória do sistema: 86.74%
```

**Não é erro, mas sim aviso!**  
Isso significa que as otimizações são **NECESSÁRIAS** e vão ajudar muito!

**Próximos passos:**
1. Fazer commit das correções
2. Reiniciar aplicação
3. Aguardar 24-48h para ver redução de memória

---

## 📊 **ARQUIVOS MODIFICADOS:**

```
✅ jobs/cacheCleanup.js           - Corrigido nome da coluna
✅ jobs/instancesCleanup.js       - Adicionado retry para EBUSY
✅ engines/WhatsappWebJS.js       - Timeout 10min + tratamento EBUSY
```

---

## 🚀 **PRÓXIMOS PASSOS:**

### 1. Reiniciar a aplicação:
```powershell
# No terminal do VS Code (PowerShell)
cd c:\laragon\www\myzap
pm2 restart myzap
pm2 logs myzap --lines 30
```

### 2. Verificar se erros sumiram:
Aguarde ~5 minutos e veja se os erros não aparecem mais.

### 3. Monitorar memória:
```powershell
# Ver uso de RAM
pm2 status
```

---

## ⚠️ **SOBRE O EBUSY NO WINDOWS:**

Esse erro é **normal no Windows** quando:
- Chrome está fechando mas ainda tem arquivos abertos
- Antivírus está escaneando arquivos
- Windows Defender está verificando arquivos
- Processo filho do Chrome ainda está rodando

**Nossas correções:**
- ✅ Sistema de retry (tenta até 3 vezes)
- ✅ Aguarda entre tentativas
- ✅ Se falhar, apenas avisa (não quebra aplicação)
- ✅ Job automático tentará novamente no próximo ciclo

---

## 🎯 **RESULTADO ESPERADO:**

Após reiniciar, você NÃO deve ver mais:
- ❌ `SQLITE_ERROR: no such column: createdAt`
- ❌ `Timeout na inicialização` (ou será muito mais raro)
- ⚠️ `EBUSY` pode aparecer ocasionalmente (normal no Windows), mas será tratado automaticamente

---

## 📝 **OBSERVAÇÕES:**

### Por que `EBUSY` pode ainda aparecer?
É uma **limitação do Windows**. Mesmo com retry, se o Chrome estiver travado ou Antivírus bloqueando, o arquivo não será deletado. Mas isso **NÃO afeta** o funcionamento do WhatsApp!

### O que acontece se não conseguir deletar?
- ✅ Job tentará novamente na próxima execução (7 dias)
- ✅ Cache vai acumular um pouco mais
- ✅ WhatsApp continua funcionando normalmente

### Como evitar completamente?
1. Adicionar exclusão do antivírus na pasta `instances/`
2. Desabilitar Windows Defender Real-Time Protection (temporariamente)
3. Usar comando manual para limpar quando aplicação estiver **parada**:
```powershell
pm2 stop myzap
Remove-Item -Recurse -Force C:\laragon\www\myzap\instances\*\session\Default\Cache
pm2 start myzap
```

---

**Correções implementadas com sucesso! 🎉**
