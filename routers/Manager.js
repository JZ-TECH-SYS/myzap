const express = require("express");
const Router = express.Router();

const { checkAuthMiddleware } = require("../middlewares/checkAuthMiddleware");
const AuthController = require("../controllers/AuthController");
const DashboardController = require("../controllers/DashboardController");

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

module.exports = Router;
