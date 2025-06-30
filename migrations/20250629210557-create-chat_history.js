'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_history', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      session: {
        type: Sequelize.TEXT,
      },
      sessionkey: {
        type: Sequelize.TEXT,
      },
      numero_cliente: {
        type: Sequelize.TEXT,
      },
      role: {
        type: Sequelize.TEXT,
      },
      msg: {
        type: Sequelize.TEXT,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Índice completo (para buscas precisas e rápidas por cliente e data)
    await queryInterface.addIndex('chat_history', [
      'session',
      'sessionkey',
      'numero_cliente',
      'created_at',
    ]);

    // Índice reduzido (para buscas rápidas por sessão geral)
    await queryInterface.addIndex('chat_history', ['session', 'sessionkey']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('chat_history');
  },
};
