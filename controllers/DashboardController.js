const os = require("os");
const { exec } = require("child_process");

const config = require("../config");
const DeviceModel = require("../Models/device");
const CompanyModel = require("../Models/company");

const Device = DeviceModel(config.sequelize);
const Company = CompanyModel(config.sequelize);

module.exports = {
  async renderDashboard(req, res) {
    try {
      const company = await Company.findOne();
      const instances = await Device.findAll();

      res.render("pages/admin/dashboard", {
        port: config.port,
        host: config.host,
        host_ssl: config.host_ssl,
        company: company?.company || config.company,
        companyData: company,
        logo: company?.logo || config.logo,
        pageTitle: 'Dashboard',
        instances,
        token: config.token,
      });

    } catch (error) {
      console.error(error);
    }
  },

  async renderConnection(req, res) {
    try {
      const company = await Company.findOne();

      res.render("pages/admin/connection", {
        token: config.token,
        port: config.port,
        host: config.host,
        host_ssl: config.host_ssl,
        company: company?.company || config.company,
        companyData: company,
        logo: company?.logo || config.logo,
        pageTitle: 'Conectar',
        apitoken: config.token
      });

    } catch (error) {
      console.error(error);
    }
  },

  async renderServer(req, res) {
    try {
      const company = await Company.findOne();
      const version = require('../package.json').version || "";
      const memoryTotal = os.totalmem() / 1024 / 1024 / 1024;
      const memoryUsed = process.memoryUsage().heapUsed / 1024 / 1024;
      const cpu = process.cpuUsage().system / 1000000;
      const cpuCores = os.cpus().length;
      const cpuName = os.cpus()[0].model;
      const ramFree = os.freemem() / (1024 * 1024 * 1024);

      const renderData = {
        token: config.token,
        port: config.port,
        host: config.host,
        host_ssl: config.host_ssl,
        company: company?.company || config.company,
        logo: company?.logo || config.logo,
        companyData: company,
        pageTitle: 'Servidor',
        node_version: process.version,
        api_version: version,
        cpu_name: cpuName,
        memory: memoryTotal.toFixed(2) + " GB",
        memory_usage: memoryUsed.toFixed(2) + " MB",
        cpu_disponivel: cpuCores + " cores",
        cores_usage: (cpu / cpuCores).toFixed(2) + " cores",
        cpu_usage: cpu.toFixed(2) + " %",
        hd_size: 0,
        memoria_ram_disponivel: ramFree.toFixed(2)
      };

      if (process.platform === "win32") {
        exec('tasklist /fi "imagename eq chrome.exe" /fo csv /nh', () => {
          res.render("pages/admin/server", renderData);
        });
      } else {
        exec("pgrep chrome", () => {
          res.render("pages/admin/server", renderData);
        });
      }

    } catch (error) {
      console.error(error);
    }
  }
};
