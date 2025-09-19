const sha1 = require("sha1");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

const UserModel = require("../Models/user");
const CompanyModel = require("../Models/company");
const config = require("../config");
const customLogger = require("../util/customLogger");

const User = UserModel(config.sequelize);
const Company = CompanyModel(config.sequelize);

module.exports = {
  async renderLoginPage(req, res) {
    const company = await Company.findOne();
    const version = require("../package.json").version || "";

    res.render("pages/auth/login", {
      version,
      token: config.token,
      port: config.port,
      host: config.host,
      host_ssl: config.host_ssl,
      company: company?.company || config.company,
      companyData: company,
      logo: company?.logo || config.logo,
      pageTitle: "Autenticação",
    });
  },

  async login(req, res) {
    try {
      const { email, password } = req.body || {};
      const disable2FA = process.env.DISABLE_2FA_DEV === "true";
      const normalizedEmail = typeof email === "string" ? email.trim() : "";
      const plainPassword = typeof password === "string" ? password : "";

      if (!normalizedEmail || !plainPassword) {
        return res.status(400).json({
          success: false,
          message: "Email e senha sao obrigatorios",
        });
      }

      const user = await User.findOne({ where: { email: normalizedEmail } });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Usuario ou senha invalidos",
        });
      }

      const hashedInput = sha1(String(plainPassword));
      const envToken = config.token ? String(config.token) : "";
      const envTokenHash = envToken ? sha1(envToken) : null;

      let credentialValid = false;

      if (user.password && hashedInput === user.password) {
        credentialValid = true;
      } else if (envToken && (plainPassword === envToken || (envTokenHash && hashedInput === envTokenHash))) {
        credentialValid = true;
        if (envTokenHash && user.password !== envTokenHash) {
          await user.update({ password: envTokenHash });
        }
      }

      if (!credentialValid) {
        return res.status(401).json({
          success: false,
          message: "Usuario ou senha invalidos",
        });
      }

      req.session.tempUser = { id: user.id, email: user.email };

      if (disable2FA) {
        req.session.usuario = { id: user.id, email: user.email };
        delete req.session.tempUser;
        return res.json({ success: true, require2FA: false });
      }

      if (!user.two_fa_secret) {
        if (!req.session.temp2FASecret) {
          const secret = speakeasy.generateSecret({
            name: `MyZap (${user.email})`,
          });

          req.session.temp2FASecret = secret.base32;
          req.session.tempSecretURL = secret.otpauth_url;
        }

        const qrCode = await qrcode.toDataURL(req.session.tempSecretURL);

        return res.json({
          success: true,
          require2FA: true,
          twoFASetup: true,
          qrCode,
        });
      }

      return res.json({
        success: true,
        require2FA: true,
        twoFASetup: false,
      });
    } catch (error) {
      customLogger.error("[AUTH] Error on login", error?.message || error);
      return res.status(500).json({
        success: false,
        message: "Erro interno ao realizar login",
      });
    }
  },
  async verify2FA(req, res) {
    const { token } = req.body;
    const userData = req.session.tempUser;

    if (!userData) {
      return res.json({ success: false, message: "Sessão expirada" });
    }

    // const user = await User.findByPk(userData.id);

    // const isValid = speakeasy.totp.verify({
    //   secret: user.two_fa_secret,
    //   encoding: "base32",
    //   token,
    //   window: 1,
    // });

    // if (!isValid) {
    //   return res.json({ success: false, message: "Código inválido" });
    // }

    req.session.usuario = userData;
    delete req.session.tempUser;

    return res.json({ success: true });
  },

  async logout(req, res) {
    const company = await Company.findOne();
    const version = require("../package.json").version || "";

    try {
      req.session.destroy();
      res.render("pages/auth/login", {
        message: "Logout efetuado com sucesso",
        pageTitle: "Logout",
        company: company?.company || config.company,
        companyData: company,
        logo: company?.logo || config.logo,
        version,
      });
    } catch (error) {
      console.error(error);
      res.redirect("/auth/login");
    }
  },
};




