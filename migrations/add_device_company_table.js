module.exports = {
    up: (queryInterface, Sequelize) => {
      return queryInterface.createTable('DeviceCompanies', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        session: Sequelize.STRING,
        sessionkey: Sequelize.STRING,
        empresa_nome: Sequelize.STRING,
        api_url: Sequelize.STRING,
        createdAt: Sequelize.DATE,
        updatedAt: Sequelize.DATE,
      });
    },
    down: (queryInterface) => {
      return queryInterface.dropTable('DeviceCompanies');
    }
  };
  