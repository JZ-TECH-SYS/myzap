const SessionsHelper = require('./helper/sessions.js');
const http = require('./helper/http.js');
const chalk = require('chalk');
const logger = require('../util/logger.js');

class Sessions {
  static async instances(req, res) {
    try {
      const sessions = await SessionsHelper.listDevices();
      return http.success(res, sessions);
    } catch (err) {
      return http.fail(res, err, 400, 'Erro ao buscar instâncias');
    }
  }

  static async createClient(session, req, wppconnect = {}) {
    const sessionkey = req.headers['sessionkey'];
    const device = await SessionsHelper.getDevice(session, sessionkey);

    if (device && wppconnect?.session !== session) {
      console.log(chalk.red(`[❌ CLIENT INJECTED, SESSION INVALID] ${session} / ${sessionkey}`));
      return false;
    }

    if (device && wppconnect?.session === session) {
      SessionsHelper.injectClient(session, wppconnect);
      logger.info(`[💀 CLIENT INJECTED] ${session} / ${sessionkey}`);
      return true;
    }

    logger.error(`[❌ CLIENT INJECTED] ${session} / ${sessionkey}`);
    return false;
  }

  static async getClient(session) {
    return await SessionsHelper.getSessionWithClient(session);
  }

  static async getAllSessions(req, res) {
    try {
      const sessions = await SessionsHelper.listDevices();

      if (!sessions.length) {
        return http.notFound(res, 'Nenhuma sessão encontrada!', sessions);
      }

      return http.success(res, sessions, 'Sessões encontradas com sucesso!');
    } catch (err) {
      return http.fail(res, err, 400, 'Erro ao buscar sessões');
    }
  }

  static async getConnectionStatus(req, res) {
    try {
      const device = await SessionsHelper.getDevice(req.body.session, req.headers['sessionkey']);

      if (device?.status === 'inChat') {
        return http.json(res, 200, {
          result: 200,
          status: device.status,
          data: device
        });
      }

      return http.invalid(res, 'Sessão não está em chat', device);

    } catch (err) {
      logger.error(`[ERROR GET CONNECTION STATUS] ${req.body.session}`);
      return http.fail(res, err, 500, 'Erro ao verificar status da conexão');
    }
  }

  static async deleteSession(req, res) {
    try {
      const session = req.body.session;
      const data = await Sessions.getClient(session);
      if (!data) return http.notFound(res, 'Sessão não encontrada!');

      const { logout, close } = await SessionsHelper.fecharSessaoComLogout(data, session);
      await SessionsHelper.deleteSessionAndCleanup(session);

      return http.success(res, { logout, close }, 'Sessão Fechada com sucesso');
    } catch (err) {
      return http.fail(res, err, 500, 'Erro ao deletar sessão!');
    }
  }
}

module.exports = Sessions;
