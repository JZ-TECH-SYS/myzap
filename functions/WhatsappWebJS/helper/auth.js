const Sessions = require('../../../controllers/SessionsController.js');
const SessionsHelper = require('../../../controllers/helper/core/sessions.js');

module.exports = {
  async validarAcesso(req) {
    const session = req.query.session || req.params.session;
    const sessionkey = req.query.sessionkey || req.headers.sessionkey;

    if (!session) {
      return {
        autorizado: false,
        status: 401,
        mensagem: 'Não autorizado, verifique se o nome da sessão está correto'
      };
    }

    try {
      // ✅ CORRIGIDO - Usar método correto para buscar sessão
      const device = await SessionsHelper.getDevice(session, sessionkey);

      if (!device) {
        return {
          autorizado: false,
          status: 404,
          mensagem: 'Sessão não encontrada'
        };
      }

      // Verificar se tem QR Code disponível
      if (!device.qrCode && device.status !== 'qrCode') {
        return {
          autorizado: false,
          status: 400,
          mensagem: 'QR Code não disponível para esta sessão'
        };
      }

      return {
        autorizado: true,
        data: device
      };
    } catch (error) {
      return {
        autorizado: false,
        status: 500,
        mensagem: `Erro ao validar acesso: ${error.message}`
      };
    }
  },

  gerarQRCodeEmImagem(res, base64) {
    try {
      const img = Buffer.from(base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, ''), 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': img.length
      });
      res.end(img);
    } catch (ex) {
      return res.status(400).json({
        response: false,
        message: 'Erro ao recuperar QRCode!'
      });
    }
  }
};
