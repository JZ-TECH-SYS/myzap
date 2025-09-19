'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('chat_history', 'message_type', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });

    await queryInterface.addIndex('chat_history', ['session', 'sessionkey', 'numero_cliente', 'message_type'], {
      name: 'chat_history_session_key_type_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('chat_history', 'chat_history_session_key_type_idx');
    await queryInterface.removeColumn('chat_history', 'message_type');
  },
};

