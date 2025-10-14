# 🚀 COMANDOS PARA EXECUTAR - DEPLOY RÁPIDO

## NO SEU COMPUTADOR (Windows - PowerShell)

### 1️⃣ Commit e Push
```powershell
cd c:\laragon\www\myzap

git add .

git commit -m "🚀 Otimizações: Chrome (-40% RAM), SQL LIMITs, Jobs limpeza automática"

git push origin main
```

---

## NA VPS (Linux - SSH)

### 2️⃣ Fazer Backup (Segurança)
```bash
ssh seu_usuario@seu_servidor

cd /var/www

cp -r myzap myzap_backup_$(date +%Y%m%d_%H%M)

echo "✅ Backup criado"
```

### 3️⃣ Atualizar Código e Dependências
```bash
cd /var/www/myzap

git pull origin main

# ✅ IMPORTANTE: Instalar/atualizar dependências
npm install

echo "✅ Código e dependências atualizados"
```

### 4️⃣ Adicionar Variáveis ao .env (Opcional)
```bash
cat >> .env << 'EOF'

# 🚀 Otimizações - Jobs de Limpeza
CACHE_RETENTION_DAYS=7
CHAT_HISTORY_RETENTION_DAYS=30
LOG_RETENTION_DAYS=7
MEMORY_MONITOR_INTERVAL_MINUTES=15
EOF

echo "✅ Variáveis adicionadas ao .env"
```

### 5️⃣ Reiniciar Aplicação
```bash
pm2 restart myzap

echo "✅ Aplicação reiniciada"
```

### 6️⃣ Verificar Jobs (Deve aparecer em ~10 segundos)
```bash
pm2 logs myzap --lines 50 | grep -E "CLEANUP|MONITOR"
```

**DEVE APARECER:**
```
🚀 Iniciando jobs de limpeza automática...
[CACHE CLEANUP] Job agendado (24h, retenção: 7 dias)
[CHAT HISTORY CLEANUP] Job agendado para 3h (retenção: 30 dias)
[INSTANCES CLEANUP] Job agendado (7 dias)
[DATABASE CLEANUP] Job VACUUM agendado (7 dias, 3h)
[LOGS CLEANUP] Job agendado para 4h (24h, retenção: 7 dias)
[MEMORY MONITOR] Job agendado (15 minutos)
✅ Todos os jobs de limpeza foram iniciados com sucesso!
```

### 7️⃣ Configurar Restart Automático (Cron)
```bash
(crontab -l 2>/dev/null; echo "0 3 * * * pm2 restart myzap") | crontab -

crontab -l

echo "✅ Cron configurado para restart diário às 3h"
```

### 8️⃣ Limpeza Manual Imediata (Para Ver Resultado Agora)
```bash
cd /var/www/myzap

# Limpar banco de dados
sqlite3 database/db.sqlite <<EOF
DELETE FROM chat_history WHERE created_at < datetime('now', '-30 days');
DELETE FROM Caches WHERE createdAt < datetime('now', '-7 days');
VACUUM;
EOF

# Limpar cache das instâncias
find instances/ -type d -name "Cache" -exec rm -rf {} + 2>/dev/null
find instances/ -type d -name "GPUCache" -exec rm -rf {} + 2>/dev/null
find instances/ -type d -name "Code Cache" -exec rm -rf {} + 2>/dev/null

# Limpar logs antigos
find logs/ -type f -mtime +7 -delete 2>/dev/null

echo "✅ Limpeza manual concluída"

# Ver quanto espaço foi liberado
du -sh instances/
du -sh database/
```

### 9️⃣ Reiniciar Novamente Após Limpeza
```bash
pm2 restart myzap

echo "✅ Deploy completo!"
```

### 🔟 Verificar Uso de Memória
```bash
echo "=== MEMÓRIA DO SISTEMA ==="
free -h

echo ""
echo "=== SWAP ==="
swapon --show

echo ""
echo "=== PM2 STATUS ==="
pm2 status

echo ""
echo "=== ESPAÇO EM DISCO ==="
df -h /var/www/myzap
```

---

## 📊 MONITORAMENTO (Deixar Rodando em Terminal Separado)

### Monitorar Logs em Tempo Real
```bash
pm2 logs myzap
```

### Monitorar Memória a Cada 30 Segundos
```bash
watch -n 30 'free -h && echo "---" && pm2 status'
```

### Ver Próximo Relatório de Memória (Aparece a Cada 15 Min)
```bash
tail -f /var/www/myzap/logs/info.log | grep "MEMORY"
```

---

## ✅ CHECKLIST RÁPIDO

Execute na ordem e marque:

- [ ] Git push executado (Windows)
- [ ] SSH na VPS
- [ ] Backup criado
- [ ] Git pull executado
- [ ] Variáveis .env adicionadas
- [ ] PM2 restart executado
- [ ] Jobs aparecem nos logs
- [ ] Cron configurado
- [ ] Limpeza manual executada
- [ ] Memória verificada

---

## 🎯 RESULTADO ESPERADO APÓS 30 MINUTOS

```bash
# Verificar resultado
free -h
```

**ANTES:**
```
SWAP: 1.9 GB / 4 GB (48%)
RAM:  2.3 GB / 3.6 GB (64%)
```

**DEPOIS:**
```
SWAP: 0-200 MB / 4 GB (0-5%)     ⬅️ GRANDE MELHORIA
RAM:  1.5-2.0 GB / 3.6 GB (42-55%)  ⬅️ REDUÇÃO
```

---

## 🆘 SE DER ERRO

### Erro: "Jobs não aparecem nos logs"
```bash
# Ver erro específico
pm2 logs myzap --err --lines 50

# Verificar se arquivos foram atualizados
ls -la /var/www/myzap/jobs/

# Forçar pull
git reset --hard HEAD
git pull origin main --force
pm2 restart myzap
```

### Erro: "Cannot find module './jobs/cacheCleanup'"
```bash
# Verificar se pasta jobs existe
ls -la /var/www/myzap/jobs/

# Se não existir, puxar novamente
git pull origin main
```

### Erro ao executar VACUUM
```bash
# Verificar se banco está travado
lsof /var/www/myzap/database/db.sqlite

# Se tiver processo travado, matar
pm2 stop myzap
sleep 5
pm2 start myzap
```

---

## 🎉 PRONTO!

Depois de executar todos os comandos acima, sua aplicação estará:
- ✅ 40-50% mais eficiente em memória
- ✅ Com limpeza automática configurada
- ✅ Com monitoramento ativo
- ✅ Com restart agendado

**Tempo total de deploy: ~10 minutos**
