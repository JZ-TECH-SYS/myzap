const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {

    class Cache extends Model {
        // Métodos

        static associate(models) {
            // define association here
        }
    }
    
    Cache.init({
        number: DataTypes.STRING,
        profile: DataTypes.STRING,
        updated_at: DataTypes.DATE,
        created_at: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'Cache', // Nome do modelo
    });

    return Cache;
};
