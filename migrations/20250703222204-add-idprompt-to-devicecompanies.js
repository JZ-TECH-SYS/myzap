'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('DeviceCompanies', 'idprompt', {
      type: Sequelize.TEXT,   // agora é TEXT
      allowNull: true,
    });
  },

  down: async (queryInterface, _Sequelize) => {
    await queryInterface.removeColumn('DeviceCompanies', 'idprompt');
  },
};
