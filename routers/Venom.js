import express from'express';

const Router = express.Router();

import Mensagens from'../functions/Venom/mensagens.js';
import Auth from'../functions/Venom/auth.js';
import { checkParams } from'../middlewares/validations.js';
import { checkNumber } from'../middlewares/checkNumber.js';

Router.post('/start', checkParams,Mensagens.startSession)

//Sessões
Router.get('/getQrCode', Auth.getQrCode);

//Mensagens
Router.post('/sendText', checkParams, checkNumber, Mensagens.sendText);
Router.post('/sendImage', checkParams, checkNumber, Mensagens.sendImage);
Router.post('/sendVideo', checkParams, checkNumber, Mensagens.sendVideo);

export default { Router };
