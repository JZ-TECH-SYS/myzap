'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('DeviceCompanies');
    if (!tableInfo.idprompt) {
      await queryInterface.addColumn('DeviceCompanies', 'idprompt', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeColumn('DeviceCompanies', 'idprompt');
  },
};
