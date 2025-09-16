/**
 * Stealth Engine para WhatsApp Web
 * Sistema de anti-detecção baseado em comportamentos humanos
 */

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
        // ✅ Argumentos extras para Windows (prevenir Code: 21)
        '--disable-web-security',
        '--disable-site-isolation-trials',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-extensions',
        '--disable-default-apps',
        '--no-first-run',
        '--single-process' // ✅ Importante para evitar conflitos no Windows
    ];
}

/**
 * Configuração stealth completa
 */
function getStealthConfig(session) {
    // ✅ Corrigido: usar apenas o diretório base, WppConnect adiciona o nome da sessão
    const tokensPath = './instances';
    
    return {
        // Configurações básicas
        headless: false,           // SEMPRE visível para parecer humano
        devtools: false,
        debug: false,
        logQR: true,
        updatesLog: false,
        useChrome: false,
        
        // Timeouts conservadores
        autoClose: 0,              // Sem auto-close
        autoCloseInterval: 0,
        deviceSyncTimeout: 0,      // Sem timeout de sync
        
        // Configurações de sessão
        disableWelcome: true,
        whatsappVersion: undefined,
        folderNameToken: tokensPath, // ✅ Apenas o diretório base
        waitForLogin: true,
        browserRevision: undefined,
        createPathFileToken: false,
        disableSpins: true,
        tokenStore: 'file',
        
        // Puppeteer ultra-conservador
        puppeteerOptions: {
            headless: false,       // SEMPRE visível
            timeout: 0,            // Sem timeout
            slowMo: randomDelay(200, 800), // Ações lentas e randômicas
            
            // Argumentos mínimos
            args: getStealthBrowserArgs(),
            
            // Configurações padrão
            ignoreDefaultArgs: false,
            defaultViewport: null,
            ignoreHTTPSErrors: true,
            
            // Handlers desabilitados
            handleSIGINT: false,
            handleSIGTERM: false,
            handleSIGHUP: false
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
