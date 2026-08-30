const helper = require('./helper/auth.js');

module.exports = class Auth {
  static async getQrCode(req, res) {
    const validacao = helper.validarAcesso(req);

    if (!validacao.autorizado) {
      return res.status(validacao.status).json({
        result: validacao.status,
        message: validacao.mensagem
      });
    }

    const qrBase64 = validacao.data.qrCode;
    return helper.gerarQRCodeEmImagem(res, qrBase64);
  }
};
