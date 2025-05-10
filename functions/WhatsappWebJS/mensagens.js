
const helper = require('./helper/mensagens');

module.exports = class Mensagens {
  static sendText = helper.sendText;
  static addStatusText = helper.addStatusText;
  static sendImage = helper.sendImage;
  static sendVideo = helper.sendVideo;
  static sendSticker = helper.sendSticker;
  static sendFile = helper.sendFile;
  static sendAudio = helper.sendAudio;
  static sendLocation = helper.sendLocation;
  static sendContact = helper.sendContact;
  static sendLink = helper.sendLink;
  static startSession = helper.startSession;
};
