const path = require('path');
const { Sequelize } = require('sequelize');
const config = require('../config.js');

(async () => {
  try {
    const sequelize = config.sequelize || new Sequelize({
      dialect: 'sqlite',
      storage: path.join(__dirname, '..', 'database', 'db.sqlite')
    });

    const [rows] = await sequelize.query("PRAGMA table_info('chat_history')");
    const cols = rows.map(r => r.name);
    const expected = ['id','session','sessionkey','numero_cliente','role','msg','message_type','created_at'];

    console.log('Colunas atuais:', cols);
    console.log('Faltando:', expected.filter(c => !cols.includes(c)));

    const [meta] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name='SequelizeMeta'");
    if (meta.length) {
      const [migrations] = await sequelize.query('SELECT * FROM SequelizeMeta ORDER BY name');
      console.log('\nMigrations aplicadas:');
      migrations.forEach(m => console.log('-', m.name));
    } else {
      console.log('Tabela SequelizeMeta não encontrada – migrations podem não ter sido executadas.');
    }

    await sequelize.close();
  } catch (e) {
    console.error('Erro ao checar schema:', e.message);
  }
})();
