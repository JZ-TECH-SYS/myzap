module.exports = (sequelize, DataTypes) => {
    const DeviceCompany = sequelize.define('DeviceCompany', {
      session: DataTypes.STRING,
      sessionkey: DataTypes.STRING,
      empresa_nome: DataTypes.STRING,
      api_url: DataTypes.STRING
    });
    return DeviceCompany;
  };
  