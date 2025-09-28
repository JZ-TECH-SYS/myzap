const moment = require('moment');
const customLogger = require('../../../util/customLogger.js');
const config = require('../../../config.js');

const DeviceModel = require('../../../Models/device.js');
const Device = DeviceModel(config.sequelize);

/**
 * Helper para gerenciar mudanças de estado de conexão
 * Processa eventos de conexão/desconexão, conflitos, timeouts
 */
class ConnectionStateManager {
  
  /**
   * Configura listeners de mudança de estado
   */
  static setupStateChange(session, client, req) {
    if (typeof client?.onStateChange === 'function') {
      // WPPConnect & Venom
      client.onStateChange(async (state) => {
        await this.processStateChange(state, session, client, req);
      });
    } else if (typeof client?.on === 'function') {
      // WhatsApp Web.js
      client.on('change_state', async (state) => {
        await this.processStateChange(state, session, client, req);
      });
    }
  }

  /**
   * Processa mudanças de estado e atualiza banco
   */
  static async processStateChange(state, session, client, req) {
    customLogger.info('State changed', state);
    
    try {
      await Device.update(
        { state, updated_at: moment().format('YYYY-MM-DD HH:mm:ss') },
        { where: { session } }
      );
    } catch (err) {
      customLogger.error(`Erro ao atualizar estado no banco: ${err.message}`);
    }

    // Processar estados específicos
    switch (state) {
      case 'OPENING':
        customLogger.info(`[SESSION] ${session} - Abrindo navegador.`);
        break;
        
      case 'PAIRING':
        customLogger.info(`[SESSION] ${session} - Lendo o QRCode.`);
        break;
        
      case 'CONFLICT':
        if (client?.useHere) {
          client.useHere();
          customLogger.info(`[SESSION] ${session} - Conflito de login resolvido com useHere().`);
        }
        break;
        
      case 'UNPAIRED':
        try {
          await Device.destroy({ where: { session } });
          customLogger.info(`[SESSION] ${session} - Dispositivo removido (UNPAIRED).`);
        } catch (err) {
          customLogger.error(`Erro ao remover dispositivo: ${err.message}`);
        }
        break;
        
      case 'TIMEOUT':
        if (client?.startPhoneWatchdog && client?.stopPhoneWatchdog) {
          client.startPhoneWatchdog(15000);
          client.stopPhoneWatchdog(15000);
          customLogger.info(`[SESSION] ${session} - Watchdog reiniciado (TIMEOUT).`);
        }
        break;
    }
  }
}

module.exports = ConnectionStateManager;
