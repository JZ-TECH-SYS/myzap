const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class DeviceCompany extends Model {
    static associate(models) {
      // relações futuras, se quiser
    }
  }

  DeviceCompany.init({
    session: DataTypes.STRING,
    sessionkey: DataTypes.STRING,
    empresa_nome: DataTypes.STRING,
    api_url: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'DeviceCompany',
  });

  return DeviceCompany;
};
