'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('DeviceCompanies', 'ia_ativa', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('DeviceCompanies', 'tempo_mensagem_padrao', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    try {
      await queryInterface.removeIndex('DeviceCompanies', ['session', 'sessionkey']);
    } catch (error) {
      // índice pode não existir ou já ser único; apenas loga no console para debug local
      console.warn('[MIGRATION] Índice session/sessionkey não removido:', error?.message);
    }

    await queryInterface.addIndex('DeviceCompanies', ['session', 'sessionkey'], {
      unique: true,
      name: 'device_companies_session_sessionkey_unique',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('DeviceCompanies', 'device_companies_session_sessionkey_unique');

    await queryInterface.addIndex('DeviceCompanies', ['session', 'sessionkey'], { name: 'device_companies_session_sessionkey' });

    await queryInterface.removeColumn('DeviceCompanies', 'tempo_mensagem_padrao');
    await queryInterface.removeColumn('DeviceCompanies', 'ia_ativa');
  },
};

