'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('DeviceCompanies');
    
    if (!tableInfo.ia_ativa) {
      await queryInterface.addColumn('DeviceCompanies', 'ia_ativa', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }

    if (!tableInfo.tempo_mensagem_padrao) {
      await queryInterface.addColumn('DeviceCompanies', 'tempo_mensagem_padrao', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    try {
      await queryInterface.removeIndex('DeviceCompanies', ['session', 'sessionkey']);
    } catch (error) {
      console.warn('[MIGRATION] Índice session/sessionkey não removido:', error?.message);
    }

    try {
      await queryInterface.addIndex('DeviceCompanies', ['session', 'sessionkey'], {
        unique: true,
        name: 'device_companies_session_sessionkey_unique',
      });
    } catch (error) {
      console.warn('[MIGRATION] Índice já existe:', error?.message);
    }
  },

  async down(queryInterface, Sequelize) {
    try {
      await queryInterface.removeIndex('DeviceCompanies', 'device_companies_session_sessionkey_unique');
      await queryInterface.addIndex('DeviceCompanies', ['session', 'sessionkey'], { name: 'device_companies_session_sessionkey' });
    } catch (e) {}

    await queryInterface.removeColumn('DeviceCompanies', 'tempo_mensagem_padrao');
    await queryInterface.removeColumn('DeviceCompanies', 'ia_ativa');
  },
};

