/**
 * Usuário DONO das sessões (Devices.user_id é NOT NULL).
 *
 * Historicamente as engines faziam `User.findOne({ email: process.env.EMAIL })`
 * e confiavam que a linha existia no banco — ela vinha embutida numa semente
 * mantida à mão. Num banco recém-criado (semente gerada pelas migrations, ou
 * reset) o lookup voltava null, o upsert do device ia sem user_id e TODO
 * /start morria em SQLITE_CONSTRAINT antes de abrir o navegador — "o QR
 * nunca aparecia". Agora o usuário do sistema é criado sob demanda.
 */

const UserModel = require('../../../Models/user.js');
const config = require('../../../config.js');
const customLogger = require('../../../util/customLogger.js');

const User = UserModel(config.sequelize);

let cachedUser = null;

async function getOrCreateSystemUser() {
    if (cachedUser) return cachedUser;

    const email = String(process.env.EMAIL || 'admin@local.myzap').trim();
    const [user, created] = await User.findOrCreate({
        where: { email },
        defaults: {
            first_name: 'Sistema',
            last_name: 'MyZap',
            email,
            created_at: new Date()
        }
    });

    if (created) {
        customLogger.info(`👤 Usuário do sistema criado automaticamente (${email})`);
    }

    cachedUser = user;
    return user;
}

module.exports = { getOrCreateSystemUser };
