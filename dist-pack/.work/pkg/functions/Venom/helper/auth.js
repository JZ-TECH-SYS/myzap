const Sessions = require('../../../controllers/SessionsController.js');

module.exports = {
  validarAcesso(req) {
    const session = req.query.session;
    const sessionkey = req.query.sessionkey;

    if (!session) {
      return {
        autorizado: false,
        status: 401,
        mensagem: 'Não autorizado, verifique se o nome da sessão está correto'
      };
    }

    const data = Sessions.getSession(session);

    if (!data || data.sessionkey !== sessionkey) {
      return {
        autorizado: false,
        status: 401,
        mensagem: 'Não autorizado, verifique se o sessionkey está correto'
      };
    }

    return {
      autorizado: true,
      data
    };
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
