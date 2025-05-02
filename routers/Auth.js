const express = require("express");
const router = express.Router();
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const sha1 = require("sha1");

const UserModel = require("../Models/user");
const config = require("../config");
const User = UserModel(config.sequelize);

// 🔐 POST /api/auth/login
router.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({
    where: { email, password: sha1(password) }
  });

  if (!user) {
    return res.json({ success: false, message: "Credenciais inválidas" });
  }

  req.session.tempUser = { id: user.id, email: user.email };

  // Se o usuário ainda não tem 2FA ativo
  if (!user.two_fa_secret) {
    // ❗ Só gera secret se ainda não existir na sessão
    if (!req.session.temp2FASecret) {
      const secret = speakeasy.generateSecret({
        name: `MyZap (${user.email})`
      });

      req.session.temp2FASecret = secret.base32;
      req.session.tempSecretURL = secret.otpauth_url;
    }

    // Gera QR code com o otpauth_url da sessão
    console.log('TOKENNNNNNNNNNNNNN:', req.session.tempSecretURL);
    console.log('SECRETTT:', req.session.temp2FASecret);
    const qrCode = await qrcode.toDataURL(req.session.tempSecretURL);

    return res.json({
      success: true,
      require2FA: true,
      twoFASetup: true,
      qrCode
    });
  }

  // Se já tem 2FA → vai para validação do código
  return res.json({
    success: true,
    require2FA: true,
    twoFASetup: false
  });
});


// ✅ POST /api/auth/2fa/setup
router.post("/api/auth/2fa/setup", async (req, res) => {
  const { token } = req.body;
  const userData = req.session.tempUser;
  const tempSecret = req.session.temp2FASecret;

  if (!userData || !tempSecret) {
    return res.json({ success: false, message: "Sessão expirada" });
  }
  console.log("📥 Token recebido:", token);
  console.log("🧾 Usuário da sessão:", req.session.tempUser);
  console.log("🔐 Secret da sessão:", tempSecret);
  const isValid = speakeasy.totp.verify({
    secret: tempSecret,
    encoding: "base32",
    token,
    window: 1
  });

  if (!isValid) {
    return res.json({ success: false, message: "Código inválido" });
  }

  const user = await User.findByPk(userData.id);
  console.log('usuario', { user })
  await user.update({ two_fa_secret: tempSecret });

  // Autentica de verdade agora
  req.session.usuario = userData;
  delete req.session.tempUser;
  delete req.session.temp2FASecret;

  return res.json({ success: true });
});

// 🔐 POST /api/auth/2fa/verify
router.post("/api/auth/2fa/verify", async (req, res) => {
  const { token } = req.body;
  const userData = req.session.tempUser;

  if (!userData) {
    return res.json({ success: false, message: "Sessão expirada" });
  }

  const user = await User.findByPk(userData.id);

  const isValid = speakeasy.totp.verify({
    secret: user.two_fa_secret,
    encoding: "base32",
    token,
    window: 1
  });

  if (!isValid) {
    return res.json({ success: false, message: "Código inválido" });
  }

  // Agora autentica de verdade
  req.session.usuario = userData;
  delete req.session.tempUser;

  return res.json({ success: true });
});

module.exports = router;
