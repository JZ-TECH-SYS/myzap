const helper = require('./helper/auth.js');
const customLogger = require('../../util/customLogger.js'); // Logger padronizado

module.exports = class Auth {
  static async getQrCode(req, res) {
    // CORRIGIDO - GET usa query params, não body
    const session = req.query.session || req.params.session;
    customLogger.info(`[GET QR CODE] ${session}`);
    
    if (!session) {
      return res.status(400).json({
        result: 400,
        message: 'Parâmetro session é obrigatório'
      });
    }
    
    try {
      // CORRIGIDO - Método agora é async
      const validacao = await helper.validarAcesso(req);

      if (!validacao.autorizado) {
        return res.status(validacao.status).json({
          result: validacao.status,
          message: validacao.mensagem
        });
      }

      const qrBase64 = validacao.data.qrCode;
      
      if (!qrBase64) {
        return res.status(404).json({
          result: 404,
          message: 'QR Code não disponível para esta sessão'
        });
      }
      
      return helper.gerarQRCodeEmImagem(res, qrBase64);
    } catch (error) {
      console.error(`[GET QR CODE ERROR] ${session}:`, error);
      return res.status(500).json({
        result: 500,
        message: 'Erro interno do servidor'
      });
    }
  }
};
