const DeviceModel = require('../../../Models/device.js');
const config = require('../../../config.js');
const customLogger = require('../../../util/customLogger.js'); // Logger padronizado

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

  /**
   * 🔍 Retorna todas as sessões ativas na memória com seus clients
   * Usado pelo Health Check para verificar sessões zumbi
   */
  getAllSessions() {
    const sessions = [];
    for (const [session, client] of Object.entries(this.clients)) {
      if (client) {
        sessions.push({ session, client });
      }
    }
    return sessions;
  },

  /**
   * Retorna o client de uma sessão (alias para getInjectedClient)
   */
  getClient(session) {
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
      customLogger.error(`[❌ DELETE SESSION] ${session} - ${err.message}`);
      return false;
    }
  },

  /**
   * Remove cliente da memória (usado pelo health check para zombies)
   * NÃO remove do banco de dados - apenas limpa a referência em memória
   */
  removeClientFromMemory(session) {
    try {
      if (this.clients[session]) {
        delete this.clients[session];
        customLogger.info(`[MEMORY CLEANUP] ${session}: Cliente removido da memória`);
        return true;
      }
      return false;
    } catch (err) {
      customLogger.error(`[MEMORY CLEANUP ERROR] ${session}: ${err.message}`);
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
  },

  async atualizarTentativasStartSeguro(session, data) {
    try {
      const currentAttempts = data?.attempts_start || 0;
      const lastStart = data?.last_start ? new Date(data.last_start) : new Date();
      
      await Device.update({
        attempts_start: currentAttempts + 1,
        last_start: lastStart
      }, { where: { session } });
      
      return true;
    } catch (error) {
      console.error(`[ATTEMPTS UPDATE ERROR] ${session} - ${error.message}`);
      return false;
    }
  }
};

module.exports = SessionsHelper;
