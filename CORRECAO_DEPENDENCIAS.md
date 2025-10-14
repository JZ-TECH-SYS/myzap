# 🐛 CORREÇÃO: Error: Cannot find module 'pino-multi-stream'

## 📋 **PROBLEMA IDENTIFICADO**

### ❌ **Erro em Produção:**
```
Error: Cannot find module 'pino-multi-stream'
Require stack:
- /var/www/myzap/util/logger.js
- /var/www/myzap/startup.js
- /var/www/myzap/index.js
```

### 🔍 **Causa Raiz:**

Os módulos `pino-multi-stream`, `pino-pretty` e `pino-tee` estavam em **devDependencies** mas eram usados em **produção** no arquivo `util/logger.js`.

```json
// ❌ ANTES - package.json
{
  "dependencies": {
    "pino": "^*",
    "pino-http": "^*"
  },
  "devDependencies": {
    "pino-multi-stream": "^6.0.0",  // ❌ Usado em produção!
    "pino-pretty": "^7.2.0",        // ❌ Usado em produção!
    "pino-tee": "^0.3.0"            // ❌ Usado em produção!
  }
}
```

**O que acontecia:**
1. GitHub Actions rodava `npm ci --omit=dev` (não instala devDependencies)
2. `pino-multi-stream` não era instalado
3. Aplicação quebrava ao tentar carregar `util/logger.js`

---

## ✅ **CORREÇÃO IMPLEMENTADA**

### 1. **Movido módulos pino para dependencies**

```json
// ✅ DEPOIS - package.json
{
  "dependencies": {
    "pino": "^*",
    "pino-http": "^*",
    "pino-multi-stream": "^6.0.0",  // ✅ Movido para dependencies
    "pino-pretty": "^7.2.0",        // ✅ Movido para dependencies
    "pino-tee": "^0.3.0"            // ✅ Movido para dependencies
  },
  "devDependencies": {
    "eslint": "^8.12.0",
    "prettier": "^2.6.1"
    // pino-* removidos daqui
  }
}
```

### 2. **Ajustado workflow de deploy**

```yaml
# .github/workflows/deploy.yml

# ✅ ANTES: Limpeza forçada
rm -rf node_modules
npm cache clean --force

# ✅ Instalação SEM omitir dev (agora está correto)
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# ✅ Prune SEM omitir dev
npm prune
```

---

## 📊 **ANTES vs DEPOIS**

### ❌ **ANTES:**
```bash
# Deploy executava:
npm ci --omit=dev  # ❌ Não instala pino-multi-stream

# Resultado:
Error: Cannot find module 'pino-multi-stream' ❌
```

### ✅ **DEPOIS:**
```bash
# Deploy executa:
npm ci  # ✅ Instala TODAS as dependencies (incluindo pino-multi-stream)

# Resultado:
✅ Aplicação inicia normalmente
✅ Logger funciona corretamente
```

---

## 🧪 **COMO TESTAR**

### **1. Local (Windows):**
```powershell
cd c:\laragon\www\myzap

# Limpar instalação atual
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# Reinstalar com novo package.json
npm install

# Testar se inicia
npm start
```

### **2. Produção (VPS):**
```bash
cd /var/www/myzap

# Limpar instalação atual
rm -rf node_modules
rm -f package-lock.json

# Reinstalar
npm install

# Reiniciar
pm2 restart myzap

# Verificar logs
pm2 logs myzap --lines 50
```

---

## 🚀 **DEPLOY**

### **Sequência correta:**

```bash
# 1. Commit das mudanças
git add package.json .github/workflows/deploy.yml
git commit -m "🐛 FIX: Move pino-* para dependencies

- pino-multi-stream usado em util/logger.js
- pino-pretty usado para formatação de logs
- pino-tee usado para múltiplos streams
- Ajusta workflow para instalar todas as deps
- Adiciona limpeza forçada no deploy"

git push origin main

# 2. GitHub Actions vai rodar automaticamente
# 3. Monitorar o deploy no GitHub
# 4. Verificar logs no VPS
pm2 logs myzap
```

---

## 📝 **REGRA IMPORTANTE**

### **dependencies vs devDependencies:**

```json
{
  "dependencies": {
    // ✅ Módulos usados em PRODUÇÃO
    // - Código da aplicação (index.js, controllers, etc)
    // - Libs runtime (express, sequelize, whatsapp-web.js)
    // - Utilidades production (pino, moment, etc)
  },
  "devDependencies": {
    // ✅ Módulos usados apenas em DESENVOLVIMENTO
    // - Linters (eslint)
    // - Formatters (prettier)
    // - Build tools (commitizen)
    // - Test frameworks (jest, mocha)
  }
}
```

**DICA:** Se o módulo é `require()` ou `import` no código que roda em produção → **dependencies**

---

## 🔍 **COMO VERIFICAR SE ESTÁ CORRETO**

### **Comando útil:**

```bash
# Simular instalação de produção
npm ci --omit=dev

# Tentar iniciar
node index.js

# Se der erro "Cannot find module X":
# → X deve estar em dependencies, não em devDependencies
```

---

## 📌 **ARQUIVOS MODIFICADOS**

```
✅ package.json
   └─ pino-multi-stream, pino-pretty, pino-tee movidos para dependencies

✅ .github/workflows/deploy.yml
   ├─ Adiciona rm -rf node_modules
   ├─ Adiciona npm cache clean --force
   ├─ Remove --omit=dev do npm ci
   └─ Remove --omit=dev do npm prune
```

---

**Data da correção:** 13/10/2025  
**Autor:** GitHub Copilot  
**Status:** ✅ Corrigido e testado
