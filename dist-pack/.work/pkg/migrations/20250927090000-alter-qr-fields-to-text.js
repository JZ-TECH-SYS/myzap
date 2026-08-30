'use strict';

/**
 * Migração para alterar colunas qrCode e urlCode para TEXT (caso estejam como STRING/VARCHAR).
 * Em SQLite a alteração de tipo é permissiva, mas mantemos lógica para outros dialetos.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const dialect = queryInterface.sequelize.getDialect();

    // Para SQLite não há changeColumn efetivo, mas chamamos para manter compatibilidade.
    try {
      await queryInterface.changeColumn('Devices', 'qrCode', { type: Sequelize.TEXT });
    } catch (err) {
      console.log('[MIGRATION] Aviso ao alterar qrCode → TEXT:', err.message);
    }
    try {
      await queryInterface.changeColumn('Devices', 'urlCode', { type: Sequelize.TEXT });
    } catch (err) {
      console.log('[MIGRATION] Aviso ao alterar urlCode → TEXT:', err.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // Reverter para STRING(255) se necessário
    try {
      await queryInterface.changeColumn('Devices', 'qrCode', { type: Sequelize.STRING });
    } catch (err) {
      console.log('[MIGRATION DOWN] Aviso ao reverter qrCode:', err.message);
    }
    try {
      await queryInterface.changeColumn('Devices', 'urlCode', { type: Sequelize.STRING });
    } catch (err) {
      console.log('[MIGRATION DOWN] Aviso ao reverter urlCode:', err.message);
    }
  }
};
