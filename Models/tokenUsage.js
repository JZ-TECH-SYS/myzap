module.exports = (sequelize, DataTypes) => {
    const TokenUsage = sequelize.define('TokenUsage', {
      session: DataTypes.STRING,
      sessionkey: DataTypes.STRING,
      mesano: DataTypes.STRING, // Ex: '202405'
      tokens_consumed: DataTypes.INTEGER
    });
    return TokenUsage;
  };
  