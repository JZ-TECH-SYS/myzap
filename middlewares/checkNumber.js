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
      logger.error(`[CHECKNUMBER] Dispositivo não conectado - Sessão: ${req?.body?.session ?? ""}`);
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

  let status_permited = ["inChat", "qrReadSuccess", "isLogged","CONNECTED"];

  if (!device || !status_permited.includes(device.status)) {
    console.log(`[CHECKNUMBER] Dispositivo não conectado - Sessão: ${req?.body?.session ?? ""}`);
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

  // ✅ LIMPEZA MAIS CUIDADOSA - preservar todos os dígitos
  number = number.toString().replace(/\s/g, ""); // Remove espaços
  number = number.replace(/[^0-9]/g, ""); // Remove tudo exceto números
  
  console.log(`[CLEAN NUMBER] Original: ${arguments[0]} → Limpo: ${number}`);
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
    const cleanedNumber = cleanNumber(number);
    console.log(`[NUMBER VERIFICATION] Verificando: ${cleanedNumber}`);
    
    if (isGroupNumber(cleanedNumber)) {
      console.log(`[GROUP NUMBER] ${cleanedNumber} → ${cleanedNumber}@g.us`);
      await Cache.set(cleanedNumber, `${cleanedNumber}@g.us`);
    } else {
      // ✅ VERIFICAR SE CLIENT TEM O MÉTODO
      if (client && typeof client.checkNumberStatus === 'function') {
        console.log(`[DEBUG] Verificando número ${cleanedNumber} no WhatsApp...`);
        const profile = await client.checkNumberStatus(cleanedNumber);
        console.log(`[DEBUG] Resultado checkNumberStatus:`, JSON.stringify(profile, null, 2));

        if (!profile?.numberExists) {
          console.log(`[ERROR] Número ${cleanedNumber} NÃO EXISTE no WhatsApp segundo checkNumberStatus`);
          return res.status(404).json({
            response: false,
            status: "error",
            message: `O telefone informado ${cleanedNumber} não está registrado no WhatsApp.`,
            profile: profile,
          });
        }

        const whatsappId = profile?.id?._serialized || `${cleanedNumber}@c.us`;
        console.log(`[NUMBER VERIFIED] ${cleanedNumber} → ${whatsappId}`);
        await Cache.set(cleanedNumber, whatsappId);
      } else {
        // ✅ FALLBACK - Se client não tem o método, assumir formato padrão
        const fallbackId = `${cleanedNumber}@c.us`;
        console.log(`⚠️ [FALLBACK] ${cleanedNumber} → ${fallbackId} (método checkNumberStatus não disponível)`);
        await Cache.set(cleanedNumber, fallbackId);
      }
    }
  } catch (error) {
    logger.error(`[HANDLE NUMBER VERIFICATION] ${error.message}`);

    throw new Error(`Erro ao verificar o número: ${error.message}`);
  }
}

exports.checkNumber = checkNumber;
