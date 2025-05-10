const Sessions = require("../../../controllers/SessionsController");
const Cache = require("../../../util/cache");
const logger = require("../../../util/logger");

const moment = require("moment");
moment().format("DD-MM-YYYY HH:mm:ss");
moment.locale("pt-br");

module.exports = {
  async getClientTokenBrowser(req, res) {
    try {
      let data = await Sessions.getClient(req.body.session);
      let response = await data.client.getClientTokenBrowser();
      res.status(200).json({ result: 200, token: response });
    } catch (error) {
      logger.error(`Error on getClientTokenBrowser: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getLastSeen(req, res) {
    try {
      let data = await Sessions.getClient(req.body.session);
      let response = await data.client.getLastSeen(req.body.number + "@c.us");
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on getLastSeen: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getTheme(req, res) {
    try {
      let data = await Sessions.getClient(req.body.session);
      let response = await data.client.getTheme();
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on getTheme: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getWAJSVersion(req, res) {
    try {
      let data = await Sessions.getClient(req.body.session);
      let response = await data.client.getWAJSVersion();
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on getWAJSVersion: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getWAVersion(req, res) {
    try {
      let data = await Sessions.getClient(req.body.session);
      let response = await data.client.getWAVersion();
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on getWAVersion: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getHostDevice(req, res) {
    try {
      let data = await Sessions.getClient(req.body.session);
      let response = await data.client.getHostDevice();
      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on getHostDevice: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getWid(req, res) {
    try {
      let data = await Sessions.getClient(req.body.session);
      const response = await data.client.getWid();
      res.status(200).json({ result: 200, number: response });
    } catch (error) {
      logger.error(`Error on getWid: ${error?.message}`);
      res
        .status(400)
        .json({
          result: 400,
          number: "",
          response: false,
          data: error?.message,
        });
    }
  },

  async getContact(req, res) {
    try {
      const { number } = req.body;
      let data = await Sessions.getClient(req.body.session);
      const response = await data.client.getContact(number + "@c.us");
      res.status(200).json({ result: 200, number: response });
    } catch (error) {
      logger.error(`Error on getContact: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getAllContacts(req, res) {
    try {
      let device = await Sessions.getClient(req.body.session);
      let client = device.client;
      let response = await client.getAllContacts();

      let contacts = response.map((data) => ({
        name: data.name || "",
        realName: data.pushname || "",
        formattedName: data.formattedName || "",
        phone: data.id.user,
        business: data.isBusiness,
        verifiedName: data.verifiedName || "",
        isMyContact: data.isMyContact,
        data: data,
      }));

      res.status(200).json({ result: 200, messages: "SUCCESS", contacts });
    } catch (error) {
      logger.error(`Error on getAllContacts: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getMessagesChat(req, res) {
    const { session, number, count, direction } = req.body;

    try {
      const device = await Sessions.getClient(session);
      const phone = await Cache?.get(number);
      const response = await device.client.getMessages(phone, {
        count: count || -1,
        direction: direction || "before",
      });

      res.status(200).json({ result: 200, data: response });
    } catch (error) {
      logger.error(`Error on getMessagesChat: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getProfilePic(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const number = req?.body?.number.replace(/[^0-9]/g, "");
      const phone = await Cache?.get(number);
      const response = await data.client.getProfilePicFromServer(phone);

      res.status(200).json({
        result: 200,
        messages: "SUCCESS",
        pic_profile: response,
      });
    } catch (error) {
      logger.error(`Error on getProfilePic: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getChat(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const phone = await Cache?.get(req?.body?.number);
      const chat = await data.client.getChatById(phone);

      if (chat) {
        return res.status(200).json({
          result: 200,
          messages: "SUCCESS",
          data: chat.contact,
          chat,
        });
      }

      res.status(400).json({ result: 400, messages: "chat not found" });
    } catch (error) {
      logger.error(`Error on getChat: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },
  async verifyNumber(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const phone = await Cache?.get(req?.body?.number);
      const profile = await data.client.checkNumberStatus(phone);

      res.status(200).json({
        result: 200,
        messages: profile.numberExists ? "SUCCESS" : "UNKNOWN",
        profile,
      });
    } catch (error) {
      logger.error(`Error on verifyNumber: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getAllChats(req, res) {
    try {
      const { session, options } = req.body;
      const device = await Sessions.getClient(session);
      const client = device.client;

      const response = await client.listChats(options || false);

      res.status(200).json({
        result: 200,
        messages: "SUCCESS",
        contacts: response,
      });
    } catch (error) {
      logger.error(`Error on getAllChats: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getAllChatsWithMessages(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const response = await data.client.getAllChatsWithMessages();

      res
        .status(200)
        .json({ result: 200, messages: "SUCCESS", contacts: response });
    } catch (error) {
      logger.error(`Error on getAllChatsWithMessages: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getAllNewMessages(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const response = await data.client.getAllNewMessages();

      res
        .status(200)
        .json({ result: 200, messages: "SUCCESS", contacts: response });
    } catch (error) {
      logger.error(`Error on getAllNewMessages: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getAllUnreadMessages(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const response = await data.client.getAllUnreadMessages();

      res
        .status(200)
        .json({ result: 200, messages: "SUCCESS", contacts: response });
    } catch (error) {
      logger.error(`Error on getAllUnreadMessages: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async getBlockList(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const response = await data.client.getBlockList();

      const blkcontacts = response.map((item) => ({
        phone: item ? item.split("@")[0] : "",
      }));

      res
        .status(200)
        .json({ result: 200, messages: "SUCCESS", contacts: blkcontacts });
    } catch (error) {
      logger.error(`Error on getBlockList: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async deleteChat(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const number = `${req?.body?.number}@c.us`;

      await data.client.deleteChat(number);

      res.status(200).json({ result: 200, messages: "SUCCESS" });
    } catch (error) {
      logger.error(`Error on deleteChat: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async clearChat(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const number = `${req?.body?.number}@c.us`;

      await data.client.clearChatMessages(number);

      res.status(200).json({ result: 200, messages: "SUCCESS" });
    } catch (error) {
      logger.error(`Error on clearChat: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async archiveChat(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const number = `${req?.body?.number}@c.us`;

      await data.client.archiveChat(number, true);

      res.status(200).json({ result: 200, messages: "SUCCESS" });
    } catch (error) {
      logger.error(`Error on archiveChat: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async deleteMessage(req, res) {
    const {
      session,
      messageId,
      deleteMediaInDevice = true,
      onlyLocal = true,
    } = req.body;

    try {
      const chatId = req?.body?.number;
      const data = await Sessions.getClient(session);

      if (!messageId || messageId.length === 0) {
        return res.status(400).json({
          status: "error",
          response: { message: "Unknown messageId" },
        });
      }

      const result = await data?.client?.deleteMessage(
        chatId,
        messageId,
        onlyLocal,
        deleteMediaInDevice
      );

      if (result) {
        return res.status(200).json({
          status: "success",
          response: { message: "Message deleted" },
        });
      }

      return res.status(400).json({
        status: "error",
        response: { message: "Error unknown on delete message" },
      });
    } catch (error) {
      logger.error(`Error on deleteMessage: ${error?.message}`);
      res.status(401).json({ status: "error", data: error?.message });
    }
  },

  async markUnseenMessage(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const number = req?.body?.number.replace(/[^0-9]/g, "");
      const phone = await Cache?.get(number);

      await data.client.markUnseenMessage(phone);

      res.status(200).json({ result: 200, messages: "SUCCESS" });
    } catch (error) {
      logger.error(`Error on markUnseenMessage: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async blockContact(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const number = req?.body?.number.replace(/[^0-9]/g, "");
      const phone = await Cache?.get(number);

      await data.client.blockContact(phone);

      res.status(200).json({ result: 200, messages: "SUCCESS" });
    } catch (error) {
      logger.error(`Error on blockContact: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async unblockContact(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const number = req.body.number;
      const phone = await Cache?.get(number);

      await data.client.unblockContact(phone);

      res.status(200).json({ result: 200, messages: "SUCCESS" });
    } catch (error) {
      logger.error(`Error on unblockContact: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async pinChat(req, res) {
    try {
      const { session, number, option } = req.body;
      const data = await Sessions.getClient(session);
      const phone = await Cache?.get(number);

      await data.client.pinChat(phone, option);

      res.status(200).json({ result: 200, messages: "SUCCESS" });
    } catch (error) {
      logger.error(`Error on pinChat: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  },

  async checkNumberStatus(req, res) {
    try {
      const data = await Sessions.getClient(req.body.session);
      const number = req?.body?.number.replace(/[^0-9]/g, "");
      const phone = await Cache?.get(number);
      const response = await data.client.checkNumberStatus(phone);

      res.status(200).json({
        result: 200,
        messages: "SUCCESS",
        phone: response.id.user,
        isBusiness: response.isBusiness,
      });
    } catch (error) {
      logger.error(`Error on checkNumberStatus: ${error?.message}`);
      res.status(400).json({ response: false, data: error?.message });
    }
  }
};
