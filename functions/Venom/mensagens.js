const helper = require('./helper/mensagens.js');

module.exports = class Mensagens {
  static sendText = helper.sendText;
  static sendImage = helper.sendImage;
  static sendVideo = helper.sendVideo;
  static sendSticker = helper.sendSticker;
  static sendFile = helper.sendFile;
  static sendFile64 = helper.sendFile64;
  static sendMultipleFile64 = helper.sendMultipleFile64;
  static sendMultipleFiles = helper.sendMultipleFiles;
  static sendAudio = helper.sendAudio;
  static sendVoiceBase64 = helper.sendVoiceBase64;
  static sendLink = helper.sendLink;
  static sendContact = helper.sendContact;
  static sendLocation = helper.sendLocation;
  static sendListMessage = helper.sendListMessage;
  static sendOrderMessage = helper.sendOrderMessage;
  static sendPollMessage = helper.sendPollMessage;
  static reply = helper.reply;
  static forwardMessages = helper.forwardMessages;
  static downloadMediaByMessage = helper.downloadMediaByMessage;
  static sendReactionToMessage = helper.sendReactionToMessage;
  static getOrderbyMsg = helper.getOrderbyMsg;
  static startSession = helper.startSession;
};
