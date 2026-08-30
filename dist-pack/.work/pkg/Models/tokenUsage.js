'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class TokenUsage extends Model {
    static associate(models) {
      // define association here (se precisar depois)
    }
  }

  TokenUsage.init({
    session: DataTypes.STRING,
    sessionkey: DataTypes.STRING,
    mesano: DataTypes.STRING, // Ex: '202405'
    tokens_consumed: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'TokenUsage',
  });

  return TokenUsage;
};
