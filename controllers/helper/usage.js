const moment = require('moment');
const TokenUsageModel = require('../../Models/tokenUsage.js');
const config = require('../../config.js');

const TokenUsage = TokenUsageModel(config.sequelize);

module.exports = async function addUsage({
    session,
    sessionkey,
    tokens = 0
}) {
    const mesano = moment().format('YYYYMM'); // ex: 202506
    const [row] = await TokenUsage.findOrCreate({
        where: { session, sessionkey, mesano },
        defaults: { tokens_consumed: 0 }
    });

    if (tokens) await row.increment('tokens_consumed', { by: tokens });
};
