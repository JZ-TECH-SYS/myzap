'use strict';

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class User extends Model {
   
    static associate(models) {
      // define association here
    }
  }
  User.init({
      first_name: DataTypes.STRING,
      last_name: DataTypes.STRING,
      email: DataTypes.STRING,
      password: DataTypes.STRING,
      cpf: DataTypes.STRING,
      phone: DataTypes.STRING,
      two_fa_secret: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'User',
  });
  return User;
};