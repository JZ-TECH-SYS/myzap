const fs = require('fs');
const tmp = require('tmp');
const OpenAI = require('openai');
const addUsage = require('./usage');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = async function transcribe({ buffer, session, sessionkey }) {
    const { name: tmpFile } = tmp.fileSync({ postfix: '.ogg' });
    fs.writeFileSync(tmpFile, buffer);

    try {
        const resp = await openai.audio.transcriptions.create(
            {
                file: fs.createReadStream(tmpFile),
                model: 'whisper-1',
                language: 'pt'
            },
            { timeout: 120000 }
        );

        const texto = resp.text?.trim() || '';
        const tokens = resp.usage?.total_tokens
            ?? Math.ceil(texto.length / 4);

        await addUsage({ session, sessionkey, tokens });

        return texto;
    } finally {
        fs.unlinkSync(tmpFile);
    }
};
