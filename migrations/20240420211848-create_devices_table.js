'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable('Devices', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      session: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      sessionkey: {
        type: Sequelize.STRING,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false
      },
      state: {
        type: Sequelize.STRING,
        allowNull: false
      },
      qrCode: {
        type: Sequelize.STRING,
        allowNull: true
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      urlCode: {
        type: Sequelize.STRING,
        allowNull: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
      },
      wh_qrcode: {
        type: Sequelize.STRING,
        allowNull: true
      },
      wh_connect: {
        type: Sequelize.STRING,
        allowNull: true
      },
      wh_message: {
        type: Sequelize.STRING,
        allowNull: true
      },
      wh_status: {
        type: Sequelize.STRING,
        allowNull: true
      },

      number: {
        type: Sequelize.STRING,
        allowNull: true
      },
      battery: {
        type: Sequelize.STRING,
        allowNull: true
      },
      blockStoreAdds: {
        type: Sequelize.STRING,
        allowNull: true
      },
      clientToken: {
        type: Sequelize.STRING,
        allowNull: true
      },
      connected: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      is24h:{
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      isResponse: {
        type: Sequelize.BOOLEAN,
        allowNull: true
      },
      lc: {
        type: Sequelize.STRING,
        allowNull: true
      },
      lg: {
        type: Sequelize.STRING,
        allowNull: true
      },
      locales: {
        type: Sequelize.STRING,
        allowNull: true
      },
      platform: {
        type: Sequelize.STRING,
        allowNull: true
      },
      plugged: {
        type: Sequelize.STRING,
        allowNull: true
      },
      protoVersion: {
        type: Sequelize.STRING,
        allowNull: true
      },
      pushname: {
        type: Sequelize.STRING,
        allowNull: true
      },
      ref: {
        type: Sequelize.STRING,
        allowNull: true
      },
      refTTL: {
        type: Sequelize.STRING,
        allowNull: true
      },
      serverToken: {
        type: Sequelize.STRING,
        allowNull: true
      },
      smbTos: {
        type: Sequelize.STRING,
        allowNull: true
      },
      tos: {
        type: Sequelize.STRING,
        allowNull: true
      },

      wa_version: {
        type: Sequelize.STRING,
        allowNull: true
      },
      wa_js_version: {
        type: Sequelize.STRING,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      last_connect: {
        type: Sequelize.DATE,
        allowNull: true
      },
      last_disconnect: {
        type: Sequelize.DATE,
        allowNull: true
      },
    });
  },

  async down(queryInterface, Sequelize) {
    // Remover a coluna user_id e a relação
    await queryInterface.removeConstraint('Devices', 'FK_device_user');
    await queryInterface.removeColumn('Devices', 'user_id');

    // Remover a tabela Devices
    await queryInterface.dropTable('Devices');
  }
};