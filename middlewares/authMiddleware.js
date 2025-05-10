module.exports = {
  // Verifica se a sessão temporária existe (usado antes do 2FA)
  ensureTempSession(req, res, next) {
    if (!req.session.tempUser) {
      return res.status(401).json({
        success: false,
        message: "Sessão temporária inválida ou expirada"
      });
    }
    next();
  },

  // Verifica se o usuário está totalmente autenticado
  requireAuth(req, res, next) {
    if (!req.session.usuario) {
      return res.status(401).json({
        success: false,
        message: "Usuário não autenticado"
      });
    }
    next();
  }
};
