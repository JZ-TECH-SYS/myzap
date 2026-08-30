const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {

    class Company extends Model { }

    Company.init({
        cnpj: DataTypes.STRING,
        company: DataTypes.STRING,
        cpf: DataTypes.STRING,
        email: DataTypes.STRING,
        logo: DataTypes.STRING,

        created_at: DataTypes.DATE,
        updated_at: DataTypes.DATE,

    }, {
        sequelize,
        tableName: 'Companys', // Nome da tabela
        modelName: 'Company', // Nome do modelo
        timezone: '-03:00', // Timezone
    });

    return Company;
};
