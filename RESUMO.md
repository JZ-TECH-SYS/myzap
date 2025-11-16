# 🚀 MyZAP - Fork JZ-TECH-SYS

**WhatsApp API + Inteligência Artificial**

---

## 📊 Resumo Executivo

Este é um fork aprimorado do projeto [billbarsch/myzap](https://github.com/billbarsch/myzap) com foco em:

- 🤖 **Inteligência Artificial**: Integração completa com OpenAI GPT-4
- 📊 **Dashboard Administrativo**: Interface web para gerenciamento
- ⚡ **Performance**: Otimizações de memória e processamento
- 🛡️ **Validações**: Sistema robusto de verificação de números
- 🔧 **Manutenção**: Jobs automáticos de limpeza e monitoramento

---

## ✨ Principais Melhorias

### 🤖 Sistema de IA

- ✅ Respostas automáticas inteligentes com OpenAI
- ✅ Sistema de Guards para controle fino
- ✅ RAG (documentos específicos)
- ✅ Detecção de pedido de atendimento humano
- ✅ Transcrição automática de áudio

### ⚡ Performance

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| RAM/sessão | 500-850 MB | 300-450 MB | **-40-50%** |
| SWAP | 1.9 GB | 0-200 MB | **-90%** |
| Disco | 2.5 GB | 1.3-1.7 GB | **-800 MB** |

### �️ Validações

- ✅ Verifica se número existe no WhatsApp
- ✅ Tenta automaticamente com/sem 9º dígito
- ✅ Cache de números validados
- ✅ Evita números fantasma

### 📊 Dashboard

- ✅ Interface em `/admin/ia-manager`
- ✅ Gerenciamento visual de sessões
- ✅ Ativar/desativar IA por sessão
- ✅ Configurar prompts e vectors

---

## 📚 Documentação

- **[README.md](./README.md)** - Documentação completa
- **[CHANGELOG.md](./CHANGELOG.md)** - Histórico de mudanças
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Como contribuir

---

## 🚀 Quick Start

```bash
# 1. Clonar repositório
git clone https://github.com/JZ-TECH-SYS/myzap.git
cd myzap

# 2. Instalar dependências
npm install

# 3. Configurar .env
cp .env.example .env
# Edite o .env com suas configurações

# 4. Rodar migrações
npm run migrate

# 5. Iniciar servidor
npm run dev
```

Acesse: `http://localhost:3000/dashboard`

---

## 🎯 Tecnologias

- Node.js 20+
- Express.js
- SQLite + Sequelize
- OpenAI GPT-4
- whatsapp-web.js / wppconnect / venom
- EJS
- PM2

---

## 🙏 Créditos

### Projeto Original

- **Bill Barsch** - [billbarsch/myzap](https://github.com/billbarsch/myzap)
- **Eduardo Policarpo** - Desenvolvedor 2.0
- **Jonathan Henrique** - Desenvolvedor 3.0

### Bibliotecas

- [wppconnect-team/wppconnect](https://github.com/wppconnect-team/wppconnect)
- [pedroslopez/whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js/)
- [orkestral/venom](https://github.com/orkestral/venom)

### Fork

**Desenvolvido por:** [JZ-TECH-SYS](https://github.com/JZ-TECH-SYS)

---

## 📝 Licença

MIT License - Veja [LICENSE](LICENSE) para detalhes.

```
Copyright (c) 2025 JZ-TECH-SYS (fork)
Copyright (c) 2024 Bill Barsch (original)
```

---

<p align="center">
  <strong>⭐ Se este projeto foi útil, considere dar uma estrela!</strong>
</p>

