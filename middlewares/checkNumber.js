const Sessions = require("../controllers/SessionsController.js");
const Cache = require("../util/cache");
const logger = require("../util/logger");

const config = require("../config.js");

const CompanyModel = require("../Models/company.js");
const Company = CompanyModel(config.sequelize);

async function checkNumber(req, res, next) {
  try {
    const device = await getConnectedDevice(req, res);
    const number = req?.body?.number;

    if (typeof device?.client === "undefined") {
      return res.status(400).send({
        error: true,
        message: `O dispositivo ${
          req?.body?.session ?? ""
        } não está conectado.`,
      });
    }

    if (!isValidNumber(number)) {
      return res.status(400).send({
        error: true,
        message: `O número informado ${number ?? ""} é inválido.`,
      });
    }

    const cachedValue = await Cache.get(number);

    if (cachedValue === null) {
      await handleNumberVerification(device?.client, number, res);
    }

    req.body.number = number;
    next();
  } catch (error) {
    logger.error(`[CHECKNUMBER] ${(error.message, error.stack)}`);

    return res.status(500).json({
      response: false,
      status: "error",
      message: `Ocorreu um erro ao verificar o número.`,
    });
  }
}

async function getConnectedDevice(req, res) {
  const device = await Sessions.getClient(req.body.session);

  let status_permited = ["inChat", "qrReadSuccess", "isLogged"];

  if (!device || !status_permited.includes(device.status)) {
    return res.status(400).send({
      error: true,
      status: device.status,
      state: device.state,
      message: `O dispositivo ${req?.body?.session ?? ""} não está conectado.`,
    });
  }

  return device;
}

function cleanNumber(number) {
  if (!number) {
    throw new Error(`O número não foi informado.`);
  }

  number = number.replace(/\s/g, "");
  number = number.replace(/[^0-9\-]/g, "");

  return number;
}

function isValidNumber(number) {
  return number.length >= 10 && number.length <= 24;
}

function isGroupNumber(number) {
  const condition =
    (number.length >= 18 && number.length <= 24) || number.includes("-");
  return condition;
}

async function handleNumberVerification(client, number, res) {
  try {
    if (isGroupNumber(number)) {
      await Cache.set(number, `${number}@g.us`);
    } else {
      const profile = await client.checkNumberStatus(number);

      if (!profile?.numberExists) {
        return res.status(404).json({
          response: false,
          status: "error",
          message: `O telefone informado ${
            number ?? ""
          } não está registrado no WhatsApp.`,
          profile: profile,
        });
      }

      await Cache.set(cleanNumber(number), profile?.id?._serialized);
    }
  } catch (error) {
    logger.error(`[HANDLE NUMBER VERIFICATION] ${error.message}`);

    throw new Error(`Erro ao verificar o número: ${error.message}`);
  }
}

exports.checkNumber = checkNumber;
