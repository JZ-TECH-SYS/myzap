'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('DeviceCompanies');
    if (!tableInfo.vector_name) {
      await queryInterface.addColumn('DeviceCompanies', 'vector_name', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('DeviceCompanies', 'vector_name');
  },
};
