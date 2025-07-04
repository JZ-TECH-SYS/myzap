'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('DeviceCompanies', 'vector_name', {
      type: Sequelize.STRING, // cabe fácil num VARCHAR(255)
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('DeviceCompanies', 'vector_name');
  },
};
