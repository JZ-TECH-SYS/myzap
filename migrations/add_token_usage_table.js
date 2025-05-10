module.exports = {
    up: (queryInterface, Sequelize) => {
      return queryInterface.createTable('TokenUsages', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        session: Sequelize.STRING,
        sessionkey: Sequelize.STRING,
        mesano: Sequelize.STRING,
        tokens_consumed: Sequelize.INTEGER,
        createdAt: Sequelize.DATE,
        updatedAt: Sequelize.DATE,
      });
    },
    down: (queryInterface) => {
      return queryInterface.dropTable('TokenUsages');
    }
  };
  