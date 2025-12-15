const os = require("os");
const v8 = require("v8");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const config = require("../config");
const DeviceModel = require("../Models/device");
const CompanyModel = require("../Models/company");
const SessionsHelper = require("./helper/core/sessions");
const { getLatestMetrics, getMetricsHistory } = require("../jobs/instanceMetrics");

const Device = DeviceModel(config.sequelize);
const Company = CompanyModel(config.sequelize);

module.exports = {
  async renderDashboard(req, res) {
    try {
      const company = await Company.findOne();
      const instances = await Device.findAll();

      // Anti-cache headers para forçar reload do HTML
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      });

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
  },

  /**
   * 📊 API - Retorna métricas gerais em tempo real
   */
  async getMetrics(req, res) {
    try {
      const metrics = await getLatestMetrics();
      
      if (!metrics) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erro ao coletar métricas' 
        });
      }
      
      return res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('[METRICS API]', error);
      return res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  },

  /**
   * 📊 API - Retorna métricas de uma sessão específica
   */
  async getSessionMetrics(req, res) {
    try {
      const { session } = req.params;
      
      // Buscar device no banco
      const device = await Device.findOne({ where: { session } });
      
      if (!device) {
        return res.status(404).json({
          success: false,
          message: 'Sessão não encontrada'
        });
      }
      
      // Calcular tamanho do disco
      const sessionPath = path.join(process.cwd(), 'instances', session);
      const diskMB = getDirSizeMB(sessionPath);
      
      // Determinar status
      const status = device.status || 'unknown';
      const isConnected = ['CONNECTED', 'inChat', 'isLogged', 'isConnected'].includes(status);
      
      // Calcular uptime
      const lastConnect = device.last_connect ? new Date(device.last_connect) : null;
      const uptimeMs = lastConnect && isConnected ? Date.now() - lastConnect.getTime() : 0;
      const uptimeHours = (uptimeMs / (1000 * 60 * 60)).toFixed(2);
      
      // Tentar obter info do client
      let clientInfo = null;
      try {
        const sessionData = SessionsHelper.getInjectedClient(session);
        if (sessionData && sessionData.info) {
          clientInfo = {
            pushname: sessionData.info.pushname,
            platform: sessionData.info.platform,
            phone: sessionData.info.wid?.user
          };
        }
      } catch (e) {
        // Ignorar - client pode não estar disponível
      }
      
      const metrics = {
        session: device.session,
        sessionkey: device.sessionkey,
        number: device.number,
        pushname: device.pushname || clientInfo?.pushname || 'N/A',
        platform: device.platform || clientInfo?.platform || 'N/A',
        status: device.status,
        state: device.state,
        connected: isConnected,
        
        // Versões
        wa_version: device.wa_version || 'N/A',
        wa_js_version: device.wa_js_version || 'N/A',
        
        // Bateria (se disponível)
        battery: device.battery || 'N/A',
        plugged: device.plugged,
        
        // Tempos
        uptime_hours: parseFloat(uptimeHours),
        uptime_formatted: formatUptime(uptimeMs),
        last_connect: device.last_connect,
        last_disconnect: device.last_disconnect,
        created_at: device.created_at,
        updated_at: device.updated_at,
        
        // Tentativas
        attempts_start: device.attempts_start || 0,
        
        // Disco
        disk_mb: diskMB,
        
        // Webhooks configurados
        webhooks: {
          qrcode: !!device.wh_qrcode,
          connect: !!device.wh_connect,
          message: !!device.wh_message,
          status: !!device.wh_status
        }
      };
      
      return res.json({
        success: true,
        data: metrics
      });
      
    } catch (error) {
      console.error('[SESSION METRICS API]', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * 📊 API - Retorna histórico de métricas
   */
  async getMetricsHistory(req, res) {
    try {
      const { date } = req.query;
      const history = getMetricsHistory(date);
      
      return res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('[METRICS HISTORY API]', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

/**
 * Calcula tamanho de um diretório em MB
 */
function getDirSizeMB(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) {
      return 0;
    }
    
    let totalSize = 0;
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      
      if (file.isDirectory()) {
        totalSize += getDirSizeMB(filePath) * 1024 * 1024;
      } else {
        try {
          const stats = fs.statSync(filePath);
          totalSize += stats.size;
        } catch (e) {
          // Ignorar
        }
      }
    }
    
    return Math.round(totalSize / 1024 / 1024);
  } catch (err) {
    return 0;
  }
}

/**
 * Formata uptime em formato legível
 */
function formatUptime(ms) {
  if (ms <= 0) return '0m';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else {
    return `${minutes}m`;
  }
}
