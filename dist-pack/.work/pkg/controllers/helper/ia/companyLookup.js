const customLogger = require('../../../util/customLogger');
const config = require('../../../config');
const DeviceCompanyModel = require('../../../Models/deviceCompany');
const DeviceCompany = DeviceCompanyModel(config.sequelize);
const { LOG_PREFIX } = require('./iaConfig');

async function verifyCompany(session, sessionkey) {
  try {
    if (sessionkey) {
      const comChave = await DeviceCompany.findOne({ where: { session, sessionkey } });
      if (comChave) return comChave;
      const fallback = await DeviceCompany.findOne({ where: { session } });
      if (fallback) {
        customLogger.info(`${LOG_PREFIX} Fallback empresa encontrada sem casar sessionkey (verifique header).`, { session });
      }
      return fallback;
    }
    const apenasSession = await DeviceCompany.findOne({ where: { session } });
    if (apenasSession) {
      customLogger.info(`${LOG_PREFIX} Empresa localizada apenas por session (sessionkey ausente no header).`, { session });
    }
    return apenasSession;
  } catch (err) {
    customLogger.error(`${LOG_PREFIX} Erro ao buscar empresa`, err.message || err);
    return null;
  }
}

module.exports = { verifyCompany };
