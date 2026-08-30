# 🚀 CONFIGURAÇÃO DE RESTART AUTOMÁTICO - MYZAP

## Para Linux/VPS (usando crontab)

### 1. Abrir o crontab
```bash
crontab -e
```

### 2. Adicionar linha para restart diário às 3h da madrugada
```bash
# Restart diário do MYZAP às 3h (horário com menos movimento)
0 3 * * * pm2 restart myzap
```

### 3. Salvar e fechar (Ctrl+X, depois Y, depois Enter)

### 4. Verificar se foi adicionado corretamente
```bash
crontab -l
```

---

## Explicação do Cron

```
0 3 * * *
│ │ │ │ │
│ │ │ │ └─── Dia da semana (0-7, onde 0 e 7 = Domingo)
│ │ │ └───── Mês (1-12)
│ │ └─────── Dia do mês (1-31)
│ └───────── Hora (0-23)
└─────────── Minuto (0-59)
```

**0 3 * * *** = Todo dia às 3:00 AM

---

## Outras Opções de Agendamento

### Restart a cada 12 horas (3h e 15h)
```bash
0 3,15 * * * pm2 restart myzap
```

### Restart semanal (toda segunda às 3h)
```bash
0 3 * * 1 pm2 restart myzap
```

### Restart quinzenal (dia 1 e 15 de cada mês às 3h)
```bash
0 3 1,15 * * pm2 restart myzap
```

---

## Para Windows (usando Task Scheduler)

### 1. Criar arquivo restart-myzap.bat
```bat
@echo off
cd C:\caminho\para\myzap
pm2 restart myzap
```

### 2. Abrir "Agendador de Tarefas" do Windows

### 3. Criar Nova Tarefa Básica
- Nome: Restart MYZAP
- Gatilho: Diariamente às 3:00
- Ação: Iniciar um programa
- Programa: Selecionar o arquivo restart-myzap.bat

---

## Verificação

### Ver logs do PM2 para confirmar restart
```bash
pm2 logs myzap --lines 50
```

### Ver próximos jobs agendados (Linux)
```bash
crontab -l
```

---

## ⚠️ IMPORTANTE

- O restart será RÁPIDO (5-10 segundos)
- Sessões WhatsApp serão reconectadas automaticamente
- Escolha horário com MENOS movimento (madrugada)
- Com as otimizações implementadas, você pode aumentar o intervalo gradualmente

---

## 📊 Monitoramento

Após configurar o cron, monitore por alguns dias:

```bash
# Ver uso de memória
free -h

# Ver uso de swap
swapon --show

# Ver processos do PM2
pm2 status

# Ver logs do sistema
tail -f /var/www/myzap/logs/info.log
```

---

**Criado por:** GitHub Copilot - Sistema de Otimização MYZAP
