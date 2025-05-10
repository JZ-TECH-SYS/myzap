require('dotenv').config();

const config = require('../config.js');

const CacheModel = require('../Models/cache');
const logger = require('./logger.js');
const CacheDB = CacheModel(config.sequelize);

module.exports = class Cache {
  static async get(number) {
    let cacheData = await CacheDB.findOne({ where: { number: number } });
    let response = cacheData ? cacheData.profile : null;
    logger.info(`Cache.get(${number}) = ${response}`);
    return response;
  }

  static async set(number, profile) {
    let cacheData = await CacheDB.findOne({ where: { number: number } });
    if (cacheData) {
      await CacheDB.update({ profile: profile }, { where: { number: number } });
    } else {
      await CacheDB.create({ number: number, profile: profile });
    }
    logger.info(`Cache.set(${number}, ${profile})`);
    return profile
  }

  static async del(number) {
    await CacheDB.destroy({ where: { number: number } });
    logger.info(`Cache.del(${number})`);
    return true;
  }
}