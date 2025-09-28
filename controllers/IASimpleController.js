/**
 * Controller simples para gerenciamento de IA
 * Foco: Listar sessões + toggle ON/OFF
 */

const config = require('../config.js');

// Models existentes (que já funcionam)
const DeviceCompanyModel = require('../Models/deviceCompany.js');
const DeviceCompany = DeviceCompanyModel(config.sequelize);

const DeviceModel = require('../Models/device.js');
const Device = DeviceModel(config.sequelize);

module.exports = class IASimpleController {
  
  /**
   * GET /admin/ia-manager
   * Renderiza página única de gerenciamento
   */
  static async renderManager(req, res) {
    try {
      // Buscar todas as sessões com suas configurações de IA
      const sessoes = await DeviceCompany.findAll({
        attributes: ['id', 'session', 'empresa_nome', 'ia_ativa', 'idprompt', 'vector_name'],
        order: [['id', 'ASC']]
      });

      const dados = {
        pageTitle: 'Gerenciar IA',
        company: 'MyZap',
        title: 'Gerenciar IA',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/WhatsApp_logo.svg',
        token: req.headers?.sessionkey || null,
        sessoes: sessoes || [],
        totalSessoes: sessoes.length,
        sessoesAtivas: sessoes.filter(s => s.ia_ativa).length,
        erro: null
      };

      res.render('pages/admin/ia-manager', dados);
    } catch (error) {
      console.error('[IA Manager] Erro ao carregar:', error);
      res.status(500).render('pages/admin/ia-manager', { 
        pageTitle: 'Gerenciar IA - Erro',
        company: 'MyZap',
        title: 'Gerenciar IA',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/WhatsApp_logo.svg',
        token: req.headers?.sessionkey || null,
        erro: 'Erro ao carregar sessões',
        sessoes: [],
        totalSessoes: 0,
        sessoesAtivas: 0
      });
    }
  }

  /**
   * POST /admin/ia-manager/toggle/:id
   * Alterna status da IA para uma sessão
   */
  static async toggleIA(req, res) {
    try {
      const { id } = req.params;
      
      const empresa = await DeviceCompany.findByPk(id);
      if (!empresa) {
        return res.json({ 
          success: false, 
          message: 'Sessão não encontrada' 
        });
      }

      // Toggle do status
      const novoStatus = !empresa.ia_ativa;
      await empresa.update({ 
        ia_ativa: novoStatus,
        ultima_atividade: new Date()
      });

      res.json({ 
        success: true, 
        message: `IA ${novoStatus ? 'ativada' : 'desativada'} para ${empresa.session}`,
        ia_ativa: novoStatus
      });

    } catch (error) {
      console.error('[IA Toggle] Erro:', error);
      res.json({ 
        success: false, 
        message: 'Erro interno do servidor' 
      });
    }
  }

  /**
   * GET /admin/ia-manager/status
   * Retorna status atual de todas as sessões (AJAX)
   */
  static async getStatus(req, res) {
    try {
      const sessoes = await DeviceCompany.findAll({
        attributes: ['id', 'session', 'empresa_nome', 'ia_ativa', 'idprompt', 'vector_name'],
        order: [['session', 'ASC']]
      });

      res.json({ 
        success: true, 
        sessoes: sessoes || [] 
      });
    } catch (error) {
      console.error('[IA Status] Erro:', error);
      res.json({ 
        success: false, 
        message: 'Erro ao buscar status' 
      });
    }
  }

  /**
   * POST /admin/ia-manager/create
   * Criar nova configuração de sessão
   */
  static async createSession(req, res) {
    try {
      const {
        session,
        sessionkey,
        empresa_nome,
        api_url,
        mensagem_padrao,
        idprompt,
        vector_name,
        ia_ativa
      } = req.body;

      // Validações básicas
      if (!session || !sessionkey) {
        return res.status(400).json({
          success: false,
          message: 'Session e sessionkey são obrigatórios'
        });
      }

      // Verificar se sessão já existe
      const existeSession = await DeviceCompany.findOne({
        where: { session: session.trim() }
      });

      if (existeSession) {
        return res.status(400).json({
          success: false,
          message: 'Sessão já existe'
        });
      }

      // Criar nova sessão
      const novaSession = await DeviceCompany.create({
        session: session.trim(),
        sessionkey: sessionkey.trim(),
        empresa_nome: empresa_nome?.trim() || 'Empresa',
        api_url: api_url?.trim() || null,
        mensagem_padrao: mensagem_padrao?.trim() || 'Olá! Como posso ajudar?',
        idprompt: idprompt?.trim() || null,
        vector_name: vector_name?.trim() || null,
        ia_ativa: ia_ativa === true || ia_ativa === 'true'
      });

      res.json({
        success: true,
        message: 'Sessão criada com sucesso',
        data: novaSession
      });

    } catch (error) {
      console.error('[IA Manager] Erro ao criar sessão:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * PUT /admin/ia-manager/update/:id
   * Atualizar configuração de sessão
   */
  static async updateSession(req, res) {
    try {
      const { id } = req.params;
      const {
        session,
        sessionkey,
        empresa_nome,
        api_url,
        mensagem_padrao,
        idprompt,
        vector_name,
        ia_ativa
      } = req.body;

      const sessaoExistente = await DeviceCompany.findByPk(id);
      if (!sessaoExistente) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada'
        });
      }

      // Atualizar dados
      await sessaoExistente.update({
        session: session?.trim() || sessaoExistente.session,
        sessionkey: sessionkey?.trim() || sessaoExistente.sessionkey,
        empresa_nome: empresa_nome?.trim() || sessaoExistente.empresa_nome,
        api_url: api_url?.trim() || sessaoExistente.api_url,
        mensagem_padrao: mensagem_padrao?.trim() || sessaoExistente.mensagem_padrao,
        idprompt: idprompt?.trim() || sessaoExistente.idprompt,
        vector_name: vector_name?.trim() || sessaoExistente.vector_name,
        ia_ativa: ia_ativa !== undefined ? (ia_ativa === true || ia_ativa === 'true') : sessaoExistente.ia_ativa
      });

      res.json({
        success: true,
        message: 'Sessão atualizada com sucesso',
        data: sessaoExistente
      });

    } catch (error) {
      console.error('[IA Manager] Erro ao atualizar sessão:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * DELETE /admin/ia-manager/delete/:id
   * Excluir configuração de sessão
   */
  static async deleteSession(req, res) {
    try {
      const { id } = req.params;

      const sessao = await DeviceCompany.findByPk(id);
      if (!sessao) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada'
        });
      }

      await sessao.destroy();

      res.json({
        success: true,
        message: 'Sessão excluída com sucesso'
      });

    } catch (error) {
      console.error('[IA Manager] Erro ao excluir sessão:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * GET /admin/ia-manager/session/:id
   * Buscar dados de uma sessão específica (AJAX)
   */
  static async getSessionData(req, res) {
    try {
      const { id } = req.params;

      const sessao = await DeviceCompany.findByPk(id, {
        attributes: ['id', 'session', 'sessionkey', 'empresa_nome', 'api_url', 'mensagem_padrao', 'idprompt', 'vector_name', 'ia_ativa']
      });

      if (!sessao) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada'
        });
      }

      res.json({
        success: true,
        data: sessao
      });

    } catch (error) {
      console.error('[IA Manager] Erro ao buscar sessão:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * POST /admin/ia-manager/update-config
   * Atualiza (empresa_nome, api_url, mensagem_padrao) por session + sessionkey
   * Body: { session, sessionkey, empresa_nome?, api_url?, mensagem_padrao? }
   */
  static async updateBasicConfig(req, res) {
    try {
      const { session, sessionkey, empresa_nome, api_url, mensagem_padrao, ia_ativa } = req.body || {};

      if (!session || !sessionkey) {
        return res.status(400).json({ success: false, message: 'session e sessionkey obrigatórios' });
      }

      const registro = await DeviceCompany.findOne({ where: { session, sessionkey } });
      if (!registro) {
        return res.status(404).json({ success: false, message: 'Configuração não encontrada' });
      }

      await registro.update({
        empresa_nome: empresa_nome?.trim() || registro.empresa_nome,
        api_url: api_url?.trim() || registro.api_url,
        mensagem_padrao: mensagem_padrao?.trim() || registro.mensagem_padrao
        //ia_ativa: ia_ativa ? 1 : 0 // Ativar IA automaticamente ao atualizar via API
      });

      return res.json({ success: true, message: 'Configuração atualizada', data: registro });
    } catch (error) {
      console.error('[IA Manager] Erro ao atualizar config básica:', error);
      return res.status(500).json({ success: false, message: 'Erro interno' });
    }
  }
};
