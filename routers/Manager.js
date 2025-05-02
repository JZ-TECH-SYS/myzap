"use strict";

const express = require("express");
const Router = express.Router();

const sha1 = require("sha1");

const os = require("os");
const { exec } = require("child_process");

const config = require("../config");

const DeviceModel = require('../Models/device');
const Device = DeviceModel(config.sequelize);

const { checkAuthMiddleware } = require("../middlewares/checkAuthMiddleware");

const UserModel = require('../Models/user');
const User = UserModel(config.sequelize);

const CompanyModel = require('../Models/company');
const Company = CompanyModel(config.sequelize);

const axios = require("axios");

Router.get("/", function (req, res) {
	res.redirect("/auth/login");
});

Router.get("/start", checkAuthMiddleware, function (req, res) {
	res.redirect("/auth/login");
});

Router.get("/instances", checkAuthMiddleware, function (req, res) {
	res.redirect("/dashboard");
});

Router.get('/dashboard', checkAuthMiddleware, async (req, res) => {

	try {

		const company = await Company.findOne();

		let apitoken = config?.token;

		const instances = await Device.findAll();

		res.render("pages/admin/dashboard", {
			port: config?.port,
			host: config?.host,
			host_ssl: config?.host_ssl,
			company: company?.company ? company?.company : config?.company,
			companyData: company,
			logo: company?.logo ? company?.logo : config.logo,
			pageTitle: 'Dashboard',
			instances: instances,
			token: apitoken,
		});

	} catch (error) {
		console.error(error);
	}

})

Router.get("/connection", checkAuthMiddleware, async function (req, res) {

	try {

		// Convertendo o conteúdo do arquivo JSON para um objeto JavaScript
		let apitoken = config?.token;
		const company = await Company.findOne();

		res.render("pages/admin/connection", {
			token: config?.token,
			port: config?.port,
			host: config?.host,
			host_ssl: config?.host_ssl,
			company: company?.company ? company?.company : config?.company,
			companyData: company,
			logo: company?.logo ? company?.logo : config.logo,
			pageTitle: 'Conectar',
			apitoken: apitoken
		});

	} catch (error) {
		console.error(error);
	}

});

Router.get("/auth/login", async function (req, res) {

	const company = await Company.findOne();

	try {

		const apiVersion = require('../package.json').version;

		res.render("pages/auth/login", {
			version: apiVersion || "",
			token: config?.token,
			port: config?.port,
			host: config?.host,
			host_ssl: config?.host_ssl,
			company: company?.company ? company?.company : config?.company,
			companyData: company,
			logo: company?.logo ? company?.logo : config.logo,
			pageTitle: 'Autenticação'
		});

	} catch (error) {

		res.render("pages/auth/login", {
			message: `Erro ao acessar a página de servidor: ${error}`,
			pageTitle: 'Erro interno',
			company: company?.company ? company?.company : config?.company,
			logo: company?.logo ? company?.logo : config.logo,
			version: apiVersion || ""
		});

	}
});

Router.post("/auth/login", async (req, res) => {

	const company = await Company.findOne();

	try {

		let email = req.body.email;
		let password = sha1(req.body.password);

		const apiVersion = require('../package.json').version || "";

		let user = await User.findOne({ where: { email: email, password: password } });

		if (!user) {
			res.render("pages/auth/login", {
				message: "Usuário ou senha inválidos",
				pageTitle: 'Erro de autenticação',
				company: company?.company ? company?.company : config?.company,
				logo: company?.logo ? company?.logo : config.logo,
				companyData: company,
				version: apiVersion || ""
			});
			return;
		}

		req.session.usuario = {
			id: user.id,
			email: user.email
		};

		res.redirect("/dashboard");

	} catch (error) {

		res.render("pages/auth/login", {
			message: `Erro ao acessar a página de servidor: ${error}`,
			pageTitle: 'Erro interno',
			company: company?.company ? company?.company : config?.company,
			logo: company?.logo ? company?.logo : config.logo,
			companyData: company,
			version: ""
		});

	}

});

Router.get("/auth/logout", async (req, res) => {

	const company = await Company.findOne();

	try {

		req.session.destroy();
		let apiVersion = require('../package.json').version;

		res.render("pages/auth/login", {
			message: "Logout efetuado com sucesso",
			pageTitle: 'Logout',
			company: company?.company ? company?.company : config?.company,
			logo: company?.logo ? company?.logo : config.logo,
			companyData: company,
			version: apiVersion
		});

	} catch (error) {
		console.error(error);
	}

});

Router.get("/server", checkAuthMiddleware, async (req, res) => {

	const company = await Company.findOne();

	try {

		let apiVersion = require('../package.json').version;

		let memory_disponivel_gb = require("os").totalmem() / 1024 / 1024 / 1024;
		let memory = process.memoryUsage().heapUsed / 1024 / 1024;
		let cpu = process.cpuUsage().system / 1000000;

		let cpu_disponivel = require("os").cpus().length;
		let cpu_name = require("os").cpus()[0].model;
		let cores_usados = cpu / cpu_disponivel;

		let node_version = process.version;
		let api_version = apiVersion;

		const hd_size = 0;

		const freeBytes = os.freemem();
		const freeGB = freeBytes / (1024 * 1024 * 1024);
		const memoria_ram_disponivel = freeGB.toFixed(2);

		if (process.platform === "win32") {
			exec(
				'tasklist /fi "imagename eq chrome.exe" /fo csv /nh',
				(err, stdout, stderr) => {
					if (err) {

						return res.status(500).json({
							status: 500,
							error: err,
						});

					}

					res.render("pages/admin/server", {
						token: config?.token,
						port: config?.port,
						host: config?.host,
						host_ssl: config?.host_ssl,
						company: company?.company ? company?.company : config?.company,
						logo: company?.logo ? company?.logo : config.logo,
						pageTitle: 'Servidor',
						node_version: node_version,
						api_version: api_version,
						cpu_name: cpu_name,
						memory: memory_disponivel_gb.toFixed(2) + " GB",
						memory_usage: memory.toFixed(2) + " MB",
						cpu_disponivel: cpu_disponivel + " cores",
						cores_usage: cores_usados.toFixed(2) + " cores",
						cpu_usage: cpu.toFixed(2) + " %",
						hd_size: hd_size,
						companyData: company,
						memoria_ram_disponivel: memoria_ram_disponivel,
					});

				}
			);
			return;
		}

		exec("pgrep chrome", (err, stdout, stderr) => {

			if (err) {
				return res.status(500).json({
					status: 500,
					error: err,
				});
			}

			res.render("pages/admin/server", {
				token: config?.token,
				port: config?.port,
				host: config?.host,
				host_ssl: config?.host_ssl,
				company: company?.company ? company?.company : config?.company,
				logo: company?.logo ? company?.logo : config.logo,
				pageTitle: 'Servidor',
				node_version: node_version,
				api_version: api_version,
				cpu_name: cpu_name,
				memory: memory_disponivel_gb.toFixed(2) + " GB",
				memory_usage: memory.toFixed(2) + " MB",
				cpu_disponivel: cpu_disponivel + " cores",
				cores_usage: cores_usados.toFixed(2) + " cores",
				cpu_usage: cpu.toFixed(2) + " %",
				hd_size: hd_size,
				companyData: company,
				memoria_ram_disponivel: memoria_ram_disponivel,
			});

		});

	} catch (error) {

		console.error(error);

	}

});

module.exports = Router;