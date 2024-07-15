//'use strict';
const dotenv = require('dotenv');
const assert = require('assert');

const { Sequelize } = require('sequelize');

const database_config = JSON.parse(JSON.stringify(require('./config/config.json')));

dotenv.config();

const is_production = process.env.PRODUCTION === 'true';

if (is_production) {
    database_config.development.logging = false;
}

let sequelize = new Sequelize(database_config.development);

(async () => {

    try {

        await sequelize.authenticate();
        console.log('Connection has been established successfully.');
    
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }

})();

const {
    PORT,
    HOST,
    HOST_SSL,
    TOKEN,
    HTTPS,
    VERSION,
    COMPANY,
    LOGO,
    START_ALL_SESSIONS,
    FORCE_CONNECTION_USE_HERE,
    CORS_ORIGIN,
    TIME_TYPING
} = process.env;

assert(PORT, 'PORT is required, please set the PORT variable value in the .env file');
assert(TOKEN, 'TOKEN is required, please set the ENGINE variable value in the .env file');
assert(CORS_ORIGIN, 'CORS_ORIGIN is required, please set the CORS_ORIGIN variable value in the .env file');

module.exports = {
    port: PORT,
    host: "",
    host_ssl: HOST_SSL ? HOST_SSL : `${HOST}:${PORT}`,
    token: TOKEN,
    https: HTTPS,
    version: VERSION,
    company: COMPANY ? COMPANY : "myzap",
    logo: LOGO != "" ? LOGO : "https://upload.wikimedia.org/wikipedia/commons/f/f7/WhatsApp_logo.svg",
    ssl_key_path: "",
    ssl_cert_path: "",
    start_all_sessions: START_ALL_SESSIONS,
    useHere: FORCE_CONNECTION_USE_HERE,
    device_name: "",
    cors_origin: CORS_ORIGIN,
    time_typing: TIME_TYPING,
    sequelize
}