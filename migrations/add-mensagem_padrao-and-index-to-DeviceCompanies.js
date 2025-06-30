'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Adiciona coluna mensagem_padrao
    await queryInterface.addColumn('DeviceCompanies', 'mensagem_padrao', {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // 2. Cria índice composto
    await queryInterface.addIndex('DeviceCompanies', ['session', 'sessionkey']);
  },

  async down(queryInterface, Sequelize) {
    // Remove índice
    await queryInterface.removeIndex('DeviceCompanies', ['session', 'sessionkey']);

    // Remove coluna
    await queryInterface.removeColumn('DeviceCompanies', 'mensagem_padrao');
  },
};
