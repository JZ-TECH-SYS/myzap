require('dotenv').config();
const moment = require('moment');
const OpenAI = require('openai');      // SDK oficial (CommonJS ok)

const config = require('../../config.js');
const DeviceCompanyModel = require('../../Models/deviceCompany.js');
const TokenUsageModel = require('../../Models/tokenUsage.js');

const DeviceCompany = DeviceCompanyModel(config.sequelize);
const TokenUsage = TokenUsageModel(config.sequelize);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY      // vem do .env
});

// ------------------------------------------------------------------
module.exports = {
    /**
     * Envia a mensagem do usuário para o modelo da OpenAI e grava
     * a quantidade real de tokens consumidos no mês corrente.
     */
    async processarMensagem({ session, sessionkey, message }) {
        try {
            // 1. verifica se o device pertence a uma empresa habilitada
            const empresa = await DeviceCompany.findOne({ where: { session, sessionkey } });
            if (!empresa) return null;

            const promptUsuario = message.body;

            if(!promptUsuario) {
                console.log('[IA] mensagem vazia');
                return null;
            }

            console.log('[IA] processando mensagem:', promptUsuario);

            // 2. chama o modelo (chat completions)
            const completion = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: 'Você é um atendente da empresa.' },
                    { role: 'user', content: promptUsuario }
                ]
            });

            // 3. resposta e tokens usados
            const textoResposta = completion.choices?.[0]?.message?.content?.trim() || null;
            const tokensGastos = completion.usage?.total_tokens || 0;   // número real

            // 4. grava / incrementa tokens do mês (YYYYMM)
            const mesano = moment().format('YYYYMM');
            const [registro] = await TokenUsage.findOrCreate({
                where: { session, sessionkey, mesano },
                defaults: { tokens_consumed: 0 }
            });
            await registro.increment('tokens_consumed', { by: tokensGastos });

            return textoResposta;
        } catch (err) {
            console.error('[IA] erro:', err);
            return null;
        }
    }
};