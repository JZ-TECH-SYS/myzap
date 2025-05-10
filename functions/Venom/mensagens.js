const helper = require('./helper/mensagens.js');

module.exports = class Mensagens {
  static sendText = helper.sendText;
  static sendImage = helper.sendImage;
  static sendVideo = helper.sendVideo;
  static sendSticker = helper.sendSticker;
  static sendFile = helper.sendFile;
  static sendFile64 = helper.sendFile64;
  static sendAudio = helper.sendAudio;
  static sendVoiceBase64 = helper.sendVoiceBase64;
  static sendLink = helper.sendLink;
  static sendContact = helper.sendContact;
  static sendLocation = helper.sendLocation;
  static reply = helper.reply;
  static forwardMessages = helper.forwardMessages;
  static getOrderbyMsg = helper.getOrderbyMsg;
  static startSession = helper.startSession;
};
