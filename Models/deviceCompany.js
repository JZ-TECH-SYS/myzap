const { Model, DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  class DeviceCompany extends Model {
    static associate(models) {
      // relations placeholder
    }
  }

  DeviceCompany.init({
    session: DataTypes.STRING,
    sessionkey: DataTypes.STRING,
    empresa_nome: DataTypes.STRING,
    api_url: DataTypes.STRING,
    mensagem_padrao: DataTypes.TEXT,
    idprompt: DataTypes.TEXT,
    vector_name: DataTypes.STRING,
    ia_ativa: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }
  }, {
    sequelize,
    modelName: 'DeviceCompany',
  });

  return DeviceCompany;
};
