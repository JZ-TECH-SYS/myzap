const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {

    class Configuration extends Model {
        // Métodos

        static associate(models) {
            // define association here
        }
    }
    
    Configuration.init({
        port: DataTypes.STRING,
        host: DataTypes.STRING,
        host_ssl: DataTypes.STRING,
        company: DataTypes.STRING,
        logo: DataTypes.STRING,
        cors_origin: DataTypes.STRING,
        time_typing: DataTypes.INTEGER,
        version: DataTypes.STRING,
        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'Configuration', // Nome do modelo
    });

    return Configuration;
};
