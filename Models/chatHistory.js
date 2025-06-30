const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    class ChatHistory extends Model {
        static associate(models) {
            // define association here if needed in future
        }
    }

    ChatHistory.init({
        session: DataTypes.TEXT,
        sessionkey: DataTypes.TEXT,
        numero_cliente: DataTypes.TEXT,
        role: DataTypes.TEXT,
        msg: DataTypes.TEXT,
        created_at: DataTypes.DATE,
    }, {
        sequelize,
        modelName: 'ChatHistory',
        tableName: 'chat_history',
        timestamps: false,
    });

    return ChatHistory;
};
