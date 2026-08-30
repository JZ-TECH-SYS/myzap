const texto = require('./helper/mensagens/texto');
const midia = require('./helper/mensagens/midia');
const audio = require('./helper/mensagens/audio');
const file = require('./helper/mensagens/file');
const interacao = require('./helper/mensagens/interacao');
const localizacao = require('./helper/mensagens/localizacao');
const util = require('./helper/mensagens/util');

module.exports = class Mensagens {
  // texto
  static sendText = texto.sendText;
  static reply = texto.reply;
  static forwardMessages = texto.forwardMessages;

  // mídia
  static sendImage = midia.sendImage;
  static sendVideo = midia.sendVideo;
  static sendSticker = midia.sendSticker;

  // áudio
  static startRecording = audio.startRecording;
  static stopRecording = audio.stopRecording;
  static sendAudio = audio.sendAudio;
  static sendVoiceBase64 = audio.sendVoiceBase64;

  // arquivos
  static sendFile = file.sendFile;
  static sendFileLocal = file.sendFileLocal;
  static sendFile64 = file.sendFile64;
  static sendMultipleFiles = file.sendMultipleFiles;
  static sendMultipleFile64 = file.sendMultipleFile64;
  static downloadMediaByMessage = file.downloadMediaByMessage;

  // interações e utilitários diversos
  static startTyping = interacao.startTyping;
  static stopTyping = interacao.stopTyping;
  static createNewsletter = interacao.createNewsletter;
  static editMessage = interacao.editMessage;
  static sendListMessage = interacao.sendListMessage;
  static sendOrderMessage = interacao.sendOrderMessage;
  static sendPollMessage = interacao.sendPollMessage;
  static sendReactionToMessage = interacao.sendReactionToMessage;
  static getPlatformFromMessage = interacao.getPlatformFromMessage;

  // localização
  static sendLocation = localizacao.sendLocation;

  // links e contatos
  static sendLink = util.sendLink;
  static sendContact = util.sendContact;

  //start
  static startSession = util.startSession;
};
