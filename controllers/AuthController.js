const sha1 = require("sha1");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

const UserModel = require("../Models/user");
const CompanyModel = require("../Models/company");
const config = require("../config");

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
    const { email, password } = req.body;
    const company = await Company.findOne();
    const version = require("../package.json").version || "";

    try {
      const user = await User.findOne({
        where: { email, password: sha1(password) },
      });

      if (!user) {
        return res.render("pages/auth/login", {
          message: "Usuário ou senha inválidos",
          pageTitle: "Erro de autenticação",
          company: company?.company || config.company,
          companyData: company,
          logo: company?.logo || config.logo,
          version,
        });
      }

      req.session.tempUser = { id: user.id, email: user.email };

      // Se o usuário ainda não tem 2FA ativo
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
      res.render("pages/auth/login", {
        message: `Erro interno: ${error}`,
        pageTitle: "Erro interno",
        company: company?.company || config.company,
        logo: company?.logo || config.logo,
        companyData: company,
        version,
      });
    }
  },

  async setup2FA(req, res) {
    const { token } = req.body;
    const tempSecret = req.session.temp2FASecret;
    const userData = req.session.tempUser;

    if (!userData || !tempSecret) {
      return res.json({ success: false, message: "Sessão expirada" });
    }

    // const isValid = speakeasy.totp.verify({
    //   secret: tempSecret,
    //   encoding: "base32",
    //   token,
    //   window: 1,
    // });

    // if (!isValid) {
    //   return res.json({ success: false, message: "Código inválido" });
    // }

    const user = await User.findByPk(userData.id);
    await user.update({ two_fa_secret: tempSecret });

    req.session.usuario = userData;
    delete req.session.tempUser;
    delete req.session.temp2FASecret;

    return res.json({ success: true });
  },

  async verify2FA(req, res) {
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
      window: 1,
    });

    if (!isValid) {
      return res.json({ success: false, message: "Código inválido" });
    }

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
