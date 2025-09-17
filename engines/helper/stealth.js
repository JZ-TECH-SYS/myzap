/**
 * Stealth Engine para WhatsApp Web
 * Sistema de anti-detecção baseado em comportamentos humanos
 */

const path = require('path');
const customLogger = require('../../util/customLogger');

/**
 * Gera delays aleatórios para simular comportamento humano
 */
function randomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Gera User-Agent realista baseado no sistema
 */
function generateUserAgent() {
    const chromeVersions = ['120.0.0.0', '119.0.0.0', '118.0.0.0', '117.0.0.0'];
    const version = chromeVersions[Math.floor(Math.random() * chromeVersions.length)];
    
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
}

/**
 * Argumentos mínimos e "normais" para o browser
 * ✅ Otimizado para Windows e prevenção de Code: 21
 */
function getStealthBrowserArgs() {
    return [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--log-level=3',
        '--no-default-browser-check',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-features=VizDisplayCompositor',
        // extras úteis (cuidado com flags que causam crash em alguns ambientes)
        '--disable-web-security',
        '--disable-site-isolation-trials',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-extensions',
        '--disable-default-apps',
        '--no-first-run'
        // NOTE: removemos '--single-process' porque causa crash em Windows / ambientes com multi-proc
    ];
}

/**
 * Configuração stealth completa
 *
 * Behavior changes:
 * - HEADLESS por padrão (defina HEADLESS=false para dev local com interface)
 * - CHROME_PATH pode ser definido no environment para apontar Chrome/Chrome.exe
 * - userDataDir definido por sessão para persistir perfil e tokens
 */
function getStealthConfig(session) {
    // diretório base onde ficam as sessões (cada sessão terá subpasta)
    const tokensPath = './instances';
    
    // HEADLESS default true (mais estável em servidores). Para dev local: HEADLESS=false
    const useHeadlessEnv = process.env.HEADLESS;
    const headlessDefault = (typeof useHeadlessEnv !== 'undefined') ? (useHeadlessEnv === 'true') : true;
    
    // Se quiser usar um Chrome específico (Windows): defina CHROME_PATH
    const chromePath = process.env.CHROME_PATH || undefined; // ex: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

    // Construir args e remover flags problemáticas (se presentes)
    const baseArgs = getStealthBrowserArgs();
    const filteredArgs = baseArgs.filter(a => a !== '--single-process');

    customLogger.info(`[STEALTH] getStealthConfig -> session=${session} headless=${headlessDefault} useChrome=${!!chromePath}`);

    return {
        // Configurações básicas (WPPConnect)
        headless: headlessDefault,
        devtools: false,
        debug: false,
        logQR: true,
        updatesLog: false,
        useChrome: !!chromePath, // força se chromePath definido
        
        // Timeouts
        autoClose: 0,              // Sem auto-close
        autoCloseInterval: 0,
        deviceSyncTimeout: 0,      // Sem timeout de sync
        
        // Sessão / token
        disableWelcome: true,
        whatsappVersion: undefined,
        folderNameToken: tokensPath,
        waitForLogin: true,
        browserRevision: undefined,
        createPathFileToken: true,
        disableSpins: true,
        tokenStore: 'file',
        
        // Puppeteer options (mais robustas)
        puppeteerOptions: {
            headless: headlessDefault,
            timeout: 0,
            slowMo: randomDelay(200, 800),

            // args filtradas (sem single-process)
            args: filteredArgs,

            ignoreDefaultArgs: false,
            defaultViewport: null,
            ignoreHTTPSErrors: true,

            // Não deixar o Node finalizar o browser por signals internos
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false,

            // Caminho para Chrome (se definido)
            executablePath: chromePath,

            // userDataDir por sessão -> garante perfil persistente e reuso de tokens
            userDataDir: path.join(tokensPath, session, 'Default')
        }
    };
}

/**
 * Adiciona delays randômicos entre ações
 */
async function humanDelay(action = 'default') {
    const delays = {
        'qr_scan': randomDelay(2000, 5000),      // QR scan
        'page_load': randomDelay(3000, 8000),    // Carregamento de página
        'click': randomDelay(500, 1500),         // Clicks
        'default': randomDelay(1000, 3000)       // Padrão
    };
    
    const delay = delays[action] || delays.default;
    
    customLogger.info(`[STEALTH] Aguardando ${delay}ms para ${action}`);
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Simula movimento do mouse humano antes de ações importantes
 */
async function simulateHumanBehavior(page) {
    try {
        // Move mouse aleatoriamente
        await page.mouse.move(
            Math.random() * 200 + 100,
            Math.random() * 200 + 100
        );
        
        await humanDelay('click');
        
        // Scroll aleatório
        await page.evaluate(() => {
            window.scrollBy(0, Math.random() * 100 - 50);
        });
        
    } catch (error) {
        customLogger.warning(`[STEALTH] Erro ao simular comportamento humano: ${error.message}`);
    }
}

/**
 * Remove ou modifica propriedades que indicam automação
 */
async function removeAutomationSignatures(page) {
    try {
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
            
            // Modifica plugins array
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            
            // Modifica languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['pt-BR', 'pt', 'en'],
            });
        });
        
        customLogger.info('[STEALTH] Assinaturas de automação removidas');
        
    } catch (error) {
        customLogger.warning(`[STEALTH] Erro ao remover assinaturas: ${error.message}`);
    }
}

/**
 * Monitora e reage a mudanças de página suspeitas
 */
function setupStealthMonitoring(page, session) {
    // Monitor de console para detectar logs suspeitos
    page.on('console', msg => {
        const text = msg.text().toLowerCase();
        if (text.includes('automation') || text.includes('webdriver') || text.includes('bot')) {
            customLogger.warning(`[STEALTH] ${session} - Possível detecção: ${text}`);
        }
    });
    
    // Monitor de requests para URLs suspeitas
    page.on('request', request => {
        const url = request.url();
        if (url.includes('automation') || url.includes('detection')) {
            customLogger.warning(`[STEALTH] ${session} - Request suspeito: ${url}`);
        }
    });
    
    customLogger.info(`[STEALTH] Monitoramento ativo para sessão ${session}`);
}

module.exports = {
    getStealthConfig,
    humanDelay,
    simulateHumanBehavior,
    removeAutomationSignatures,
    setupStealthMonitoring,
    generateUserAgent,
    randomDelay
};
