
const express = require('express');
const Router = express.Router();
const Sessions = require('../controllers/SessionsController.js');
const Mensagens = require('../functions/WPPConnect/mensagens');
const Auth = require('../functions/WPPConnect/auth');
const config = require('../config');
const { checkParams } = require('../middlewares/validations');
const { checkNumber } = require('../middlewares/checkNumber');
const { checkAPITokenMiddleware } = require('../middlewares/checkAPITokenMiddleware');
const DeviceModel = require('../Models/device.js');


Router.post('/start', checkParams, Mensagens.startSession);
Router.post('/instances', checkAPITokenMiddleware, Sessions.instances);

// Sessões 
// #swagger.tags = ['Sessions']
Router.get('/getQrCode', Auth.getQrCode);

Router.post('/getAllSessions', Sessions.getAllSessions);
Router.post('/getConnectionStatus', checkParams, Sessions.getConnectionStatus);
Router.post('/deleteSession', Sessions.deleteSession);

// Mensagens
// #swagger.tags = ['Messages']
Router.post('/sendText', checkParams, checkNumber, Mensagens.sendText);
Router.post('/sendImage', checkParams, checkNumber, Mensagens.sendImage);
Router.post('/sendVideo', checkParams, checkNumber, Mensagens.sendVideo);
Router.post('/sendFile64', checkParams, checkNumber, Mensagens.sendFile64);
Router.post('/sendMultipleFile64', checkParams, checkNumber, Mensagens.sendMultipleFile64);
Router.post('/sendFile', checkParams, checkNumber, Mensagens.sendFile);
Router.post('/sendMultipleFiles', checkParams, checkNumber, Mensagens.sendMultipleFiles);
Router.post('/sendAudio', checkParams, checkNumber, Mensagens.sendAudio);
Router.post('/sendSticker', checkParams, checkNumber, Mensagens.sendSticker);
Router.post('/sendLocation', checkParams, checkNumber, Mensagens.sendLocation);
Router.post('/sendContact', checkParams, checkNumber, Mensagens.sendContact);
Router.post('/sendList', checkParams, checkNumber, Mensagens.sendListMessage);
Router.post('/sendOrder', checkParams, checkNumber, Mensagens.sendOrderMessage);
Router.post('/sendPoll', checkParams, checkNumber, Mensagens.sendPollMessage);
Router.post('/sendLink', checkParams, checkNumber, Mensagens.sendLink);
Router.post('/reply', checkParams, checkNumber, Mensagens.reply);
Router.post('/forward', checkParams, checkNumber, Mensagens.forwardMessages);
Router.post('/downloadMedia', checkParams, Mensagens.downloadMediaByMessage);
Router.post('/reaction', checkParams, Mensagens.sendReactionToMessage);

module.exports = Router;