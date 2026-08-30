'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('chat_history');
    
    if (!tableInfo.message_type) {
      await queryInterface.addColumn('chat_history', 'message_type', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null,
      });
    }

    try {
      await queryInterface.addIndex('chat_history', ['session', 'sessionkey', 'numero_cliente', 'message_type'], {
        name: 'chat_history_session_key_type_idx',
      });
    } catch (e) {
      console.warn('[MIGRATION] Índice chat_history_session_key_type_idx já existe');
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex('chat_history', 'chat_history_session_key_type_idx');
    } catch (e) {}
    await queryInterface.removeColumn('chat_history', 'message_type');
  },
};

