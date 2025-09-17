"use strict";

const fs = require("fs");
const express = require("express");
const session = require("express-session");
const fileUpload = require("express-fileupload");
const cors = require("cors");
const path = require("path");
const { yo } = require("yoo-hoo");
const config = require("./config");
const { startAllSessions } = require("./startup");
const logger = require("./util/logger"); // Para expressPinoLogger  
const customLogger = require("./util/customLogger"); // ✅ Logger padronizado
const expressPinoLogger = require("express-pino-logger");
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
  process.exit(1);
}

function handleUnhandledRejection(err, promise) {
  customLogger.error(`🚨 Unhandled rejection: ${err.message}`);
  customLogger.debug('Promise details:', promise);
  
  // ✅ MELHORADO - Não sair do processo imediatamente, apenas logar
  // Em desenvolvimento, é melhor continuar rodando
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}
