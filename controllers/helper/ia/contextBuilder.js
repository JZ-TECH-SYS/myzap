const eventsHelper = require('../events/events');
const { verifyCompany } = require('./companyLookup');

async function build({ message, session, client, req }) {
  const sessionkey = req.headers?.sessionkey;
  const numero = message.from;
  const msgBody = message.body || '';
  const payload = await eventsHelper.montarPayload(message, session, client);
  const empresa = await verifyCompany(session, sessionkey);
  return { session, sessionkey, numero, msgBody, payload, empresa };
}

module.exports = { build };
