'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
   
    await queryInterface.addColumn('devices', 'pid', {
      type: Sequelize.STRING,
      allowNull: true
    });

  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('devices', 'pid');

  }
};
