"use strict";

const fs = require("fs");
const express = require("express");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const path = require("path");
const { yo } = require("yoo-hoo");
const config = require("./config");
const { startAllSessions, startCleanupJobs } = require("./startup");
const SessionsHelper = require("./controllers/helper/core/sessions.js");
const { startSessionKeepAliveJob } = require("./jobs/sessionKeepAlive");
const logger = require("./util/logger"); // Para expressPinoLogger  
const customLogger = require("./util/customLogger"); // ✅ Logger padronizado
const expressPinoLogger = require("express-pino-logger");
const emailAlertService = require("./services/emailAlertService"); // 📧 Alertas por email
const authApi = require("./routers/Auth");
const chatRouter = require("./routers/Chat");

// Verifica se o diretório de instâncias existe, senão cria
if (!fs.existsSync("./instances")) {
  fs.mkdirSync("./instances");
}

// Inicialização do servidor Express
const app = express();
const server = require("http").Server(app);
// Configuração do middleware de sessão
app.use(
  session({
    secret: config.token,
    resave: false,
    saveUninitialized: false,
  })
);

// Configuração do logger
const loggerMiddleware = expressPinoLogger({
  logger: logger, // Usa logger antigo para middleware
  autoLogging: true,
});

// Configuração do CORS
const allowlist = config.cors_origin.split(", ");
app.use(cors({ origin: config.cors_origin == "*" ? "*" : allowlist }));

// Configuração para tratamento de uploads de arquivos
app.use(fileUpload({ createParentPath: true }));

// Middleware para adicionar o objeto io a todas as requisições
app.use((req, res, next) => {
  req.io = io;
  var _send = res.send;
  var sent = false;
  res.send = (data) => {
    if (sent) return;
    _send.bind(res)(data);
    sent = true;
  };
  next();
});

// Configuração para aceitar JSON e formulários codificados
app.use(express.json({ limit: "100mb", parameterLimit: 99999999999999 }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "100mb",
    parameterLimit: 99999999999999,
  })
);

// Configuração da pasta de arquivos estáticos
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "/public")));

// Configuração do view engine e da pasta de views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "Views"));

// Inicialização do socket.io
const io = require("socket.io")(server, {
  cors: {
    origin: config.cors_origin == "*" ? "*" : allowlist,
    methods: ["GET", "POST"],
  },
});

io.setMaxListeners(0); // Aumenta o número máximo de listeners

// Configuração de eventos do socket.io
io.on("connection", (socket) => {
  customLogger.info(`ID: ${socket.id} socket connected`);

  socket.on("event", (data) => {
    customLogger.info(data);
  });

  socket.on("room", (room) => {
    if (socket.room) {
      socket.leave(socket.room);
    }
    socket.join(room);
    socket.room = room;
    customLogger.info(`Session: ${room} joined Socket.io`);
  });

  socket.on("disconnect", () => {
    customLogger.info(`ID: ${socket.id} socket disconnected`);
  });
});

// Configuração de rotas baseada na engine selecionada
let router;
const engine = config.engine;

if (engine === '1') {
  router = require("./routers/WhatsappWebJS");
  customLogger.success('🚀 Engine selecionada: WhatsApp-Web-JS');
} else if (engine === '2') {
  router = require("./routers/WppConnect");
  customLogger.success('🚀 Engine selecionada: WPPConnect');
} else if (engine === '3') {
  router = require("./routers/Venom");
  customLogger.success('🚀 Engine selecionada: Venom');
} else {
  customLogger.error('Engine não reconhecida. Use 1 (WhatsappWebJS), 2 (WppConnect) ou 3 (Venom).');
  process.exit(1);
}

const manager = require("./routers/Manager");

app.use(router, loggerMiddleware);
app.use(manager);
app.use(authApi);
app.use(chatRouter);

const toPlainDevice = (device) => (device?.get ? device.get({ plain: true }) : device);

app.get('/health', async (req, res) => {
  const memoryUsage = process.memoryUsage();
  const os = require('os');
  
  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    engine: config.engine,
    // 📊 Métricas de memória para monitoramento
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),  // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      heapPercent: ((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2),
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024), // MB
    },
    system: {
      totalMemory: Math.round(os.totalmem() / 1024 / 1024), // MB
      freeMemory: Math.round(os.freemem() / 1024 / 1024), // MB
      usedPercent: (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2),
    }
  };

  try {
    await config.sequelize.authenticate();
    response.db = 'up';
  } catch (error) {
    response.db = 'down';
    response.db_error = error?.message || String(error);
  }

  try {
    const devices = await SessionsHelper.listDevices();
    const items = devices.map(toPlainDevice);
    const connected = items.filter((item) => {
      const status = (item?.status || '').toLowerCase();
      return ['connected', 'inchat', 'islogged', 'isconnected'].includes(status);
    });
    response.sessions_total = items.length;
    response.sessions_connected = connected.length;
  } catch (error) {
    response.sessions_total = 0;
    response.sessions_connected = 0;
    response.sessions_error = error?.message || String(error);
  }

  return res.json(response);
});

app.get('/health/sessions', async (req, res) => {
  try {
    const devices = await SessionsHelper.listDevices();
    const items = devices.map((device) => {
      const row = toPlainDevice(device);
      return {
        session: row.session,
        sessionkey: row.sessionkey,
        status: row.status,
        state: row.state,
        updated_at: row.updated_at,
      };
    });
    return res.json({ status: 'ok', data: items });
  } catch (error) {
    customLogger.error('[HEALTH] Falha ao listar sessoes', error?.message || error);
    return res.status(500).json({ status: 'fail', reason: 'Erro ao listar sessoes' });
  }
});

// 📊 Endpoint de métricas por instância
app.get('/api/metrics', async (req, res) => {
  try {
    const { getLatestMetrics } = require('./jobs/instanceMetrics');
    const metrics = await getLatestMetrics();
    
    if (!metrics) {
      return res.status(500).json({ status: 'error', message: 'Erro ao coletar métricas' });
    }
    
    return res.json({ status: 'ok', data: metrics });
  } catch (error) {
    customLogger.error('[METRICS] Erro ao obter métricas', error?.message || error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// 📊 Endpoint de histórico de métricas
app.get('/api/metrics/history', async (req, res) => {
  try {
    const { getMetricsHistory } = require('./jobs/instanceMetrics');
    const date = req.query.date || null; // ?date=2025-12-14
    const history = getMetricsHistory(date);
    
    return res.json({ 
      status: 'ok', 
      date: date || new Date().toISOString().split('T')[0],
      count: history.length,
      data: history 
    });
  } catch (error) {
    customLogger.error('[METRICS] Erro ao obter histórico', error?.message || error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
});

// Inicialização do servidor
server.listen(config.port, async (error) => {
  if (error) {
    customLogger.error(error);
  } else {
    yo("Myzap3", { color: "rainbow", spacing: 1, waitMode: "line" });

    const serverURL = config.host_ssl
      ? config.host_ssl
      : `${config.host}:${config.port}`;
    
    customLogger.success(`\n🚀 Server running on ${serverURL}`);
    customLogger.info(`📚 Access ${serverURL}/doc to view API documentation`);
    customLogger.info(`🤫 Engine: ${engine === '1' ? 'WhatsApp-Web-JS' : engine === '2' ? 'WPPConnect' : 'Venom'}`);

    // Inicia todas as sessões se a configuração estiver ativada
    if (config.start_all_sessions === "true") {
      try {
        customLogger.info('🔄 Iniciando todas as sessões...');
        await startAllSessions();
        customLogger.success('✅ Todas as sessões iniciadas com sucesso');
      } catch (error) {
        customLogger.error("❌ Error starting all sessions:", error);
      }
    }

    // 🚀 Iniciar jobs de limpeza automática
    startCleanupJobs();

    startSessionKeepAliveJob();
  }
});

// Tratamento de sinais e eventos do processo Node.js
process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);
process.on("beforeExit", handleProcessExit);
process.on("exit", handleProcessExit);
process.on("uncaughtException", handleUncaughtException);
process.on("unhandledRejection", handleUnhandledRejection);

function gracefulShutdown(signal) {
  customLogger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    customLogger.info("Server closed. Exiting process...");
    process.exit(0);
  });
}

function handleProcessExit(code) {
  customLogger.info(`Process exited with code: ${code}`);
}

function handleUncaughtException(err) {
  customLogger.error(`💥 Uncaught Exception: ${err.message}`);
  
  // 📧 Enviar alerta por email (não aguardar, pois vamos encerrar)
  emailAlertService.send('SYSTEM_ERROR', {
    type: 'UncaughtException',
    error: err.message,
    stack: err.stack,
    uptime: process.uptime()
  }).catch(() => {}); // Ignorar erro de email neste ponto
  
  process.exit(1);
}

function handleUnhandledRejection(reason, promise) {
  try {
    const isError = reason instanceof Error;
    const msg = isError ? reason.message : String(reason);
    customLogger.error(`🚨 Unhandled rejection: ${msg}`);
    customLogger.error(`[UNHANDLED META] typeof=${typeof reason} constructor=${reason && reason.constructor ? reason.constructor.name : 'n/a'}`);
    if (isError && reason.stack) {
      customLogger.error(reason.stack);
    } else {
      customLogger.error('[UNHANDLED RAW] ' + JSON.stringify(reason));
    }
    customLogger.debug('Promise details:', promise);
    // Também jogar no console bruto para garantir stack quando existir
    console.error('UNHANDLED REJECTION RAW:', reason);
    
    // 📧 Enviar alerta por email
    emailAlertService.send('UNHANDLED_REJECTION', {
      error: msg,
      stack: isError ? reason.stack : null,
      type: reason && reason.constructor ? reason.constructor.name : typeof reason,
      uptime: process.uptime()
    }).catch(() => {}); // Não deixar erro de email causar mais problemas
    
  } catch (logErr) {
    console.error('Falha ao logar unhandledRejection', logErr);
  }
  if (process.env.NODE_ENV === 'production') {
    // Decidir política futura
  }
}





