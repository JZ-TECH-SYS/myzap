const { Op } = require('sequelize');

const config = require('../config');
const DeviceCompanyModel = require('../Models/deviceCompany.js');
const http = require('./helper/http.js');
const customLogger = require('../util/customLogger.js');

const DeviceCompany = DeviceCompanyModel(config.sequelize);

const MAX_MESSAGE_CHARS = 1000;

function sanitizeMessage(text) {
  if (!text) return '';
  const value = String(text);
  return value
    .replace(/<[^>]*>?/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, MAX_MESSAGE_CHARS);
}

function normalizeBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  return defaultValue;
}

function parsePositiveInt(value, fallback = 0) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

function maskSessionKey(sessionkey = '') {
  if (!sessionkey) return '';
  if (sessionkey.length <= 4) return '*'.repeat(sessionkey.length);
  const visible = sessionkey.slice(-4);
  return `${'*'.repeat(sessionkey.length - 4)}${visible}`;
}

async function findDeviceCompany(id) {
  const entity = await DeviceCompany.findByPk(id);
  return entity;
}

module.exports = {
  async renderPage(req, res) {
    if (req.query.format === 'json' || req.headers.accept?.includes('application/json')) {
      return this.list(req, res);
    }

    const pageTitle = 'IA & Empresas';
    return res.render('pages/admin/device_companies', {
      pageTitle,
      logo: config.logo,
      company: config.company,
      token: config.token,
    });
  },

  async list(req, res) {
    try {
      const page = parsePositiveInt(req.query.page, 1);
      const limit = parsePositiveInt(req.query.limit || req.query.per_page, 20) || 20;
      const search = (req.query.search || '').trim();

      const where = {};
      if (search) {
        where[Op.or] = [
          { session: { [Op.like]: `%${search}%` } },
          { empresa_nome: { [Op.like]: `%${search}%` } },
        ];
      }

      const offset = (Math.max(page, 1) - 1) * limit;

      const { rows, count } = await DeviceCompany.findAndCountAll({
        where,
        order: [['updatedAt', 'DESC']],
        offset,
        limit,
      });

      const data = rows.map((row) => {
        const values = row.get({ plain: true });
        return {
          ...values,
          sessionkey_masked: maskSessionKey(values.sessionkey),
        };
      });

      return http.success(res, {
        items: data,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit) || 1,
        },
      });
    } catch (error) {
      customLogger.error('[ADMIN] Falha ao listar DeviceCompanies', error?.message || error);
      return http.fail(res, error, 500, 'Erro ao listar empresas');
    }
  },

  async create(req, res) {
    try {
      const {
        session,
        sessionkey,
        empresa_nome,
        api_url,
        mensagem_padrao,
        idprompt,
        vector_name,
        ia_ativa,
        tempo_mensagem_padrao,
      } = req.body || {};

      if (!session || !sessionkey) {
        return http.invalid(res, 'session e sessionkey sao obrigatorios');
      }

      const payload = {
        session: String(session).trim(),
        sessionkey: String(sessionkey).trim(),
        empresa_nome: empresa_nome ? String(empresa_nome).trim() : null,
        api_url: api_url ? String(api_url).trim() : null,
        mensagem_padrao: sanitizeMessage(mensagem_padrao),
        idprompt: idprompt ? String(idprompt).trim() : null,
        vector_name: vector_name ? String(vector_name).trim() : null,
        ia_ativa: normalizeBoolean(ia_ativa, true),
        tempo_mensagem_padrao: parsePositiveInt(tempo_mensagem_padrao, 0),
      };

      const [record, created] = await DeviceCompany.findOrCreate({
        where: { session: payload.session, sessionkey: payload.sessionkey },
        defaults: payload,
      });

      if (!created) {
        await record.update(payload);
      }

      customLogger.info('[ADMIN] DeviceCompany salva', { session: payload.session, sessionkey: maskSessionKey(payload.sessionkey) });

      return http.success(res, record.get({ plain: true }), 'Configuracao salva com sucesso');
    } catch (error) {
      customLogger.error('[ADMIN] Erro ao criar DeviceCompany', error?.message || error);
      return http.fail(res, error, 500, 'Erro ao salvar configuracao');
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const entity = await findDeviceCompany(id);
      if (!entity) {
        return http.notFound(res, 'Registro nao encontrado');
      }

      const {
        empresa_nome,
        api_url,
        mensagem_padrao,
        idprompt,
        vector_name,
        ia_ativa,
        tempo_mensagem_padrao,
      } = req.body || {};

      const updates = {
        empresa_nome: empresa_nome ? String(empresa_nome).trim() : null,
        api_url: api_url ? String(api_url).trim() : null,
        mensagem_padrao: sanitizeMessage(mensagem_padrao),
        idprompt: idprompt ? String(idprompt).trim() : null,
        vector_name: vector_name ? String(vector_name).trim() : null,
        ia_ativa: normalizeBoolean(ia_ativa, entity.ia_ativa),
        tempo_mensagem_padrao: parsePositiveInt(tempo_mensagem_padrao, entity.tempo_mensagem_padrao),
      };

      await entity.update(updates);

      customLogger.info('[ADMIN] DeviceCompany atualizada', { id: entity.id, session: entity.session });

      return http.success(res, entity.get({ plain: true }), 'Configuracao atualizada com sucesso');
    } catch (error) {
      customLogger.error('[ADMIN] Erro ao atualizar DeviceCompany', error?.message || error);
      return http.fail(res, error, 500, 'Erro ao atualizar configuracao');
    }
  },

  async toggleIA(req, res) {
    try {
      const { id } = req.params;
      const entity = await findDeviceCompany(id);
      if (!entity) {
        return http.notFound(res, 'Registro nao encontrado');
      }

      const nextValue = req.body?.ia_ativa !== undefined
        ? normalizeBoolean(req.body.ia_ativa, entity.ia_ativa)
        : !entity.ia_ativa;

      await entity.update({ ia_ativa: nextValue });

      customLogger.info('[ADMIN] DeviceCompany IA alternada', { id: entity.id, session: entity.session, ia_ativa: nextValue });

      return http.success(res, entity.get({ plain: true }), 'Status da IA atualizado');
    } catch (error) {
      customLogger.error('[ADMIN] Erro ao alternar IA', error?.message || error);
      return http.fail(res, error, 500, 'Erro ao alternar IA');
    }
  },
};

