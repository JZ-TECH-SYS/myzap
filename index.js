"use strict";

const fs = require("fs");
const express = require("express");
const session = require('express-session');
const fileUpload = require("express-fileupload");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const path = require("path");
const { exec } = require("child_process");
const { yo } = require("yoo-hoo");
const config = require("./config");
const CacheModel = require('./Models/cache');
const { startAllSessions } = require("./startup");
const logger = require("./util/logger");
const expressPinoLogger = require("express-pino-logger");
const authApi = require("./routers/Auth");

// Verifica se o diretório de instâncias existe, senão cria
if (!fs.existsSync('./instances')) {
    fs.mkdirSync('./instances');
}

// Inicialização do servidor Express
const app = express();
const server = require("http").Server(app);
// Configuração do middleware de sessão
app.use(session({
  secret: config.token,
  resave: false,
  saveUninitialized: false
}));

// Configuração do logger
const loggerMiddleware = expressPinoLogger({
  logger: logger,
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
app.use(express.urlencoded({ extended: true, limit: "100mb", parameterLimit: 99999999999999 }));

// Configuração da pasta de arquivos estáticos
app.use(express.static("public"));
app.use(express.static(path.join(__dirname, "/public")));

// Configuração do view engine e da pasta de views
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "Views"));

// Configuração da documentação Swagger
const swaggerFile = require("./swagger_output.json");

app.use("/doc", swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Inicialização do socket.io
const io = require("socket.io")(server, {
  cors: { origin: config.cors_origin == "*" ? "*" : allowlist, methods: ["GET", "POST"] },
});

io.setMaxListeners(0); // Aumenta o número máximo de listeners

// Configuração de eventos do socket.io
io.on("connection", (socket) => {
  logger.info(`ID: ${socket.id} socket connected`);

  socket.on("event", (data) => {
    logger.info(data);
  });

  socket.on("room", (room) => {
    if (socket.room) {
      socket.leave(socket.room);
    }
    socket.join(room);
    socket.room = room;
    logger.info(`Session: ${room} joined Socket.io`);
  });

  socket.on("disconnect", () => {
    logger.info(`ID: ${socket.id} socket disconnected`);
  });
});

// Configuração de rotas
const router = require("./routers/WppConnect");
const manager = require("./routers/Manager");

app.use(router, loggerMiddleware);
app.use(manager);
app.use(authApi);
// Inicialização do servidor
server.listen(config.port, async (error) => {
  if (error) {
    logger.error(error);
  } else {
    yo("Myzap3", { color: "rainbow", spacing: 1, waitMode: "line" });

    const serverURL = config.host_ssl ? config.host_ssl : `${config.host}:${config.port}`;
    console.log(`\nServer running on ${serverURL}\nAccess ${serverURL}/doc to view API documentation\n`);

    // Inicia todas as sessões se a configuração estiver ativada
    if (config.start_all_sessions === "true") {
      try {
        await startAllSessions();
      } catch (error) {
        logger.error("Error starting all sessions:", error);
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
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(() => {
    logger.info("Server closed. Exiting process...");
    process.exit(0);
  });
}

function handleProcessExit(code) {
  logger.info(`Process exited with code: ${code}`);
}

function handleUncaughtException(err) {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
}

function handleUnhandledRejection(err, promise) {
  logger.error("Unhandled rejection at ", promise, `reason: ${err}`);
  process.exit(1);
}
