const DeviceModel = require('../../Models/device.js');
const config = require('../../config.js');
const logger = require('../../util/logger.js');

const Device = DeviceModel(config.sequelize);

const SessionsHelper = {
  clients: {},

  async getDevice(session, sessionkey = null) {
    const where = sessionkey ? { session, sessionkey } : { session };
    return await Device.findOne({ where });
  },

  async listDevices() {
    return await Device.findAll();
  },

  injectClient(session, clientInstance) {
    this.clients[session] = clientInstance;
  },

  getInjectedClient(session) {
    return this.clients[session];
  },

  async getSessionWithClient(session) {
    const instance = await this.getDevice(session);
    if (!instance) return false;

    return {
      ...instance.dataValues,
      client: this.getInjectedClient(session)
    };
  },

  async deleteSessionAndCleanup(session) {
    try {
      await Device.destroy({ where: { session } });
      delete this.clients[session];
      return true;
    } catch (err) {
      logger.error(`[❌ DELETE SESSION] ${session} - ${err.message}`);
      return false;
    }
  },

  async fecharSessaoComLogout(data, session) {
    let logout = false, close = false;

    try {
      await data?.client?.logout();
      logout = true;
    } catch (err) {
      console.log(`[SESSION] ${session} - Erro ao fazer logout`);
    }

    try {
      await data?.client?.page?.close();
      close = true;
    } catch (err) {
      console.log(`[SESSION] ${session} - Erro ao fechar página`);
    }

    return { logout, close };
  },

  async atualizarTentativasStart(session, currentAttempts, lastStart = null) {
    await Device.update({
      attempts_start: currentAttempts + 1,
      last_start: lastStart || new Date()
    }, { where: { session } });
  }
};

module.exports = SessionsHelper;
