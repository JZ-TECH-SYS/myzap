const express = require("express");
const Router = express.Router();

const { checkAuthMiddleware } = require("../middlewares/checkAuthMiddleware");
const AuthController = require("../controllers/AuthController");
const DashboardController = require("../controllers/DashboardController");
const DeviceCompanyController = require("../controllers/DeviceCompanyController");
const IASimpleController = require("../controllers/IASimpleController");

// Redirecionamentos
Router.get("/", (req, res) => res.redirect("/auth/login"));
Router.get("/start", checkAuthMiddleware, (req, res) => res.redirect("/auth/login"));
Router.get("/instances", checkAuthMiddleware, (req, res) => res.redirect("/dashboard"));

// Dashboard
Router.get("/dashboard", checkAuthMiddleware, DashboardController.renderDashboard);
Router.get("/connection", checkAuthMiddleware, DashboardController.renderConnection);

// Auth
Router.get("/auth/login", AuthController.renderLoginPage);
Router.post("/auth/login", AuthController.login);
Router.get("/auth/logout", AuthController.logout);

// Server
Router.get("/server", checkAuthMiddleware, DashboardController.renderServer);

// Device companies / IA configuration
Router.get("/admin/device-companies", checkAuthMiddleware, DeviceCompanyController.renderPage);
Router.post("/admin/device-companies", checkAuthMiddleware, DeviceCompanyController.create);
Router.put("/admin/device-companies/:id", checkAuthMiddleware, DeviceCompanyController.update);
Router.patch("/admin/device-companies/:id/toggle-ia", checkAuthMiddleware, DeviceCompanyController.toggleIA);

// IA Manager - Sistema Simples
Router.get("/admin/ia-manager", checkAuthMiddleware, IASimpleController.renderManager);
Router.post("/admin/ia-manager/toggle/:id", checkAuthMiddleware, IASimpleController.toggleIA);
Router.get("/admin/ia-manager/status", checkAuthMiddleware, IASimpleController.getStatus);

// CRUD de Sessões
Router.post("/admin/ia-manager/create", checkAuthMiddleware, IASimpleController.createSession);
Router.put("/admin/ia-manager/update/:id", checkAuthMiddleware, IASimpleController.updateSession);
Router.delete("/admin/ia-manager/delete/:id", checkAuthMiddleware, IASimpleController.deleteSession);
Router.get("/admin/ia-manager/session/:id", checkAuthMiddleware, IASimpleController.getSessionData);
// Atualização básica via API (empresa_nome, api_url, mensagem_padrao)
Router.post("/admin/ia-manager/update-config", checkAuthMiddleware, IASimpleController.updateBasicConfig);

module.exports = Router;
