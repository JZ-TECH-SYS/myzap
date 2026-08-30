const { DataTypes, Model } = require("sequelize");

module.exports = (sequelize) => {
  class Device extends Model {
    static associate(models) {
      // Definindo a associação entre Device e User
      Device.belongsTo(models.User, {
        foreignKey: "user_id", // Chave estrangeira em Device
        as: "user",
      });
    }
  }

  Device.init(
    {
      session: DataTypes.STRING,
      sessionkey: DataTypes.STRING,
      user_id: DataTypes.INTEGER,
      wh_qrcode: DataTypes.STRING,
      wh_connect: DataTypes.STRING,
      wh_message: DataTypes.STRING,
      wh_status: DataTypes.STRING,
      status: DataTypes.STRING,
      state: DataTypes.STRING,
      qrCode: DataTypes.TEXT, // Alterado para TEXT para suportar QR Codes longos
      attempts: DataTypes.INTEGER,
      urlCode: DataTypes.TEXT, // Alterado para TEXT (alguns engines fornecem URL extensa)

      last_start: DataTypes.DATE,
      attempts_start: DataTypes.INTEGER,

      number: DataTypes.STRING,
      wa_js_version: DataTypes.STRING,
      wa_version: DataTypes.STRING,

      battery: DataTypes.STRING,
      blockStoreAdds: DataTypes.STRING,
      clientToken: DataTypes.STRING,
      connected: DataTypes.BOOLEAN,
      is24h: DataTypes.BOOLEAN,
      isResponse: DataTypes.BOOLEAN,
      lc: DataTypes.STRING,
      lg: DataTypes.STRING,
      locales: DataTypes.STRING,
      platform: DataTypes.STRING,
      plugged: DataTypes.BOOLEAN,
      protoVersion: DataTypes.STRING,
      pushname: DataTypes.STRING,
      ref: DataTypes.STRING,
      refTTL: DataTypes.STRING,
      serverToken: DataTypes.STRING,
      smbTos: DataTypes.STRING,
      tos: DataTypes.STRING,

      last_connect: DataTypes.DATE,
      last_disconnect: DataTypes.DATE,
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,

      // 📊 Campos de auditoria de entrega (adicionados para rastrear saúde real)
      last_message_sent: DataTypes.DATE,
      last_message_received: DataTypes.DATE,
      send_failure_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      last_send_error: DataTypes.TEXT,
      last_health_check: DataTypes.DATE,
      health_status: {
        type: DataTypes.STRING,
        defaultValue: "UNKNOWN",
      },
      last_auto_recovery: DataTypes.DATE,
      last_recovery_reason: DataTypes.TEXT,
      recovery_count_24h: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      modelName: "Device", // Nome do modelo
      timezone: "-03:00", // Timezone
    },
  );

  return Device;
};
