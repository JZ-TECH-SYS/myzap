const Sessions = require("../../../controllers/SessionsController");
const logger = require("../../../util/logger");

module.exports = {
  async getQrCode(req, res) {
    const session = req?.query?.session;
    const sessionkey = req?.query?.sessionkey;
    const data = await Sessions?.getClient(session);

    if (!session) {
      return res?.status(401)?.json({
        result: 401,
        messages: "Não autorizado, verifique se o nome da sessão esta correto",
      });
    }

    if (data?.sessionkey != sessionkey) {
      return res?.status(401)?.json({
        result: 401,
        messages: "Não autorizado, verifique se o sessionkey esta correto",
      });
    }

    try {
      const img = Buffer.from(
        data?.qrCode?.replace(/^data:image\/(png|jpeg|jpg);base64,/, ""),
        "base64"
      );

      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": img.length,
      });

      res.end(img);
    } catch (error) {
      logger.error(`Error on getQrCode: ${error?.message}`);

      res.status(500).json({
        response: false,
        data: error?.message,
      });
    }
  },
};
