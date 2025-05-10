const stories = require('./helper/status/stories');
const profile = require('./helper/status/profile');

module.exports = class Status {
  static sendTextToStorie = stories.sendTextToStorie;
  static sendImageToStorie = stories.sendImageToStorie;
  static sendVideoToStorie = stories.sendVideoToStorie;
  
  static setProfilePic = profile.setProfilePic;
  static setProfileName = profile.setProfileName;
  static setProfileStatus = profile.setProfileStatus;
};
