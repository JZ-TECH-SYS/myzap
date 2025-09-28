const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

// Ler o arquivo EJS
const filePath = path.join(__dirname, 'Views/pages/admin/ia-manager.ejs');
const template = fs.readFileSync(filePath, 'utf-8');

// Dados de teste
const testData = {
  sessoes: [
    {
      id: 1,
      session: 'teste',
      ia_ativa: true,
      empresa_nome: 'Teste Empresa',
      api_url: 'http://teste.com',
      mensagem_padrao: 'Teste mensagem',
      idprompt: 'prompt1',
      vector_name: 'vector1'
    }
  ],
  stats: {
    total: 1,
    ativas: 1,
    inativas: 0,
    configuradas: 1
  }
};

try {
  const rendered = ejs.render(template, testData);
  console.log('✅ Template EJS renderizado com sucesso!');
  console.log('Tamanho do HTML gerado:', rendered.length, 'caracteres');
} catch (error) {
  console.error('❌ Erro ao renderizar EJS:');
  console.error('Linha:', error.line || 'N/A');
  console.error('Coluna:', error.column || 'N/A');
  console.error('Mensagem:', error.message);
  console.error('Stack:', error.stack);
}
