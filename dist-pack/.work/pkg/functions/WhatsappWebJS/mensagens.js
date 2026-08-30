
const helper = require('./helper/mensagens');

module.exports = class Mensagens {
  static sendText = helper.sendText;
  static addStatusText = helper.addStatusText;
  static sendImage = helper.sendImage;
  static sendVideo = helper.sendVideo;
  static sendSticker = helper.sendSticker;
  static sendFile = helper.sendFile;
  static sendFile64 = helper.sendFile64;
  static sendMultipleFile64 = helper.sendMultipleFile64;
  static sendMultipleFiles = helper.sendMultipleFiles;
  static sendAudio = helper.sendAudio;
  static sendLocation = helper.sendLocation;
  static sendContact = helper.sendContact;
  static sendLink = helper.sendLink;
  static sendListMessage = helper.sendListMessage;
  static sendOrderMessage = helper.sendOrderMessage;
  static sendPollMessage = helper.sendPollMessage;
  static reply = helper.reply;
  static forwardMessages = helper.forwardMessages;
  static downloadMediaByMessage = helper.downloadMediaByMessage;
  static sendReactionToMessage = helper.sendReactionToMessage;
  static startSession = helper.startSession;
};
