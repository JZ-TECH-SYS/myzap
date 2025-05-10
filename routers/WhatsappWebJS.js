const express = require("express");
const Router = express.Router();

const Mensagens = require("../functions/WhatsappWebJS/mensagens");
const Auth = require("../functions/WPPConnect/auth");
const { checkParams } = require("../middlewares/validations");
const { checkNumber } = require("../middlewares/checkNumber");


Router.post("/start", checkParams, Mensagens.startSession)

// Sessões
Router.get("/getQrCode", Auth.getQrCode);

// Mensagens
Router.post("/sendText", checkParams, checkNumber, Mensagens.sendText);
Router.post("/sendImage", checkNumber, Mensagens.sendImage);
Router.post("/sendVideo", checkNumber, Mensagens.sendVideo);

export default { Router };
