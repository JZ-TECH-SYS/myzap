'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
 
    await queryInterface.addColumn('Devices', 'last_start', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('Devices', 'attempts_start', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Devices', 'last_start');
    await queryInterface.removeColumn('Devices', 'attempts_start');
  }
};
