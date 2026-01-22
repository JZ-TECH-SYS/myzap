const { Client, LocalAuth } = require('whatsapp-web.js');
const Launcher = require('chrome-launcher');
const Sessions = require('../controllers/SessionsController.js');
const Events = require('../controllers/EventsController.js');
const webhooks = require('../controllers/WebhooksController.js');
const config = require('../config.js');
const HelperWhatsappWeb = require('./helper/wweb.js');
const customLogger = require('../util/customLogger.js'); // ADICIONADO
const DeviceModel = require('../Models/device.js'); // ADICIONADO
const UserModel = require('../Models/user.js'); // ADICIONADO

require('dotenv').config();

const Device = DeviceModel(config.sequelize);
const User = UserModel(config.sequelize);

let chromeLauncher = Launcher.Launcher.getInstallations()[0];

// NOVO - Mapa global de timeouts por sessão para evitar timeouts órfãos
const sessionTimeouts = new Map();

// NOVO - Função para limpar timeout anterior da sessão
function clearSessionTimeout(session) {
  if (sessionTimeouts.has(session)) {
    const oldTimeout = sessionTimeouts.get(session);
    clearTimeout(oldTimeout);
    sessionTimeouts.delete(session);
    customLogger.debug(`${session} - ⏰ Timeout anterior cancelado`);
  }
}

module.exports = class WhatsappWebJS {
  static async start(req, res, session) {
    return new Promise(async (resolve, reject) => {
      let resolved = false; // ADICIONADO - Flag para evitar resolver múltiplas vezes
      let client = null; // MOVIDO PARA CIMA - Para poder destruir no timeout
      let timeoutId = null; // Referência do timeout
      
      // CRÍTICO - Limpar timeout anterior desta sessão (evita timeouts órfãos)
      clearSessionTimeout(session);
      
      // FUNÇÃO AUXILIAR - Limpar client no timeout
      const cleanupOnTimeout = async () => {
        // Remover do mapa global
        sessionTimeouts.delete(session);
        
        if (client) {
          try {
            customLogger.warning(`${session} - ⏰ Timeout: Destruindo client...`);
            await client.destroy();
            customLogger.info(`${session} - 🧹 Client destruído por timeout`);
          } catch (destroyErr) {
            customLogger.debug(`${session} - Erro ao destruir client: ${destroyErr.message}`);
          }
        }
        // Atualizar status no banco
        try {
          await Device.update({
            state: 'TIMEOUT',
            status: 'TIMEOUT',
            updated_at: new Date()
          }, { where: { session } });
        } catch (dbErr) {
          customLogger.debug(`${session} - Erro ao atualizar status timeout: ${dbErr.message}`);
        }
      };
      
      // FUNÇÃO AUXILIAR - Limpar timeout quando conectar
      const clearCurrentTimeout = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);  // <-- Aqui TEM que ser clearTimeout nativo!
          timeoutId = null;
        }
        if (sessionTimeouts.has(session)) {
          clearTimeout(sessionTimeouts.get(session));  // <-- Limpa do mapa global também
          sessionTimeouts.delete(session);
          customLogger.debug(`${session} - ⏰ Timeout cancelado (sessão conectou)`);
        }
      };
      
      // 🔧 CORRIGIDO - Timeout aumentado para 10 minutos com cleanup adequado
      timeoutId = setTimeout(async () => {
        if (!resolved) {
          resolved = true;
          await cleanupOnTimeout();
          reject(new Error(`Timeout na inicialização da sessão ${session} (10 minutos)`));
        }
      }, 600000); // 10 minutos
      
      // CRÍTICO - Guardar referência no mapa global
      sessionTimeouts.set(session, timeoutId);
      
      try {
        // ADICIONADO - Criar/atualizar device ANTES de inicializar (igual WPPConnect)
        const sessionkey = req.headers['sessionkey'];
        const number = req?.body?.number || '';
        const body = req?.body || [];

        const wh_connect = req?.body?.wh_connect || '';
        const wh_status = req?.body?.wh_status || '';
        const wh_message = req?.body?.wh_message || '';
        const wh_qrcode = req?.body?.wh_qrcode || '';

        customLogger.whatsapp(`🚀 Starting WhatsApp WebJS - Session: ${session}`);

        try {
          // ADICIONADO - Criar device igual WPPConnect
          const { empresa_nome, api_url } = body;
          const sysUser = await User.findOne({ where: { email: process.env.EMAIL } });
          
          // BUSCAR device existente para incrementar attempts_start
          const existingDevice = await Device.findOne({ where: { session } });
          const currentAttemptsStart = existingDevice?.attempts_start || 0;
          
          const devicePayload = {
            user_id: sysUser?.id,
            session,
            sessionkey,
            qrCode: '',
            attempts: 0,
            urlCode: '',
            attempts_start: currentAttemptsStart + 1, // INCREMENTAR tentativas de start
            last_start: new Date(),
            state: 'STARTING',
            status: 'INITIALIZING',
            number,
            wh_qrcode,
            wh_connect,
            wh_status,
            wh_message,
            created_at: new Date(),
            updated_at: new Date()
          };
          
          await Device.upsert(devicePayload, { conflictFields: ['session'] });
          customLogger.success(`💾 Device criado/atualizado para sessão: ${session} (tentativa ${currentAttemptsStart + 1})`);
          
        } catch (deviceError) {
          customLogger.error('❌ Erro ao criar/atualizar device:', deviceError);
          if (!resolved) {
            resolved = true;
            clearCurrentTimeout();
            reject(new Error(`Erro ao criar device: ${deviceError.message}`));
          }
          return;
        }

        const useHere = config.useHere !== 'true';

        customLogger.whatsapp(`${session} - useHere: ${useHere}`);
        // client já foi declarado no início da Promise

        // REMOVIDO Firebase - agora usa pasta local instances/
        customLogger.whatsapp(`${session} - Usando tokens da pasta instances/`);

        // ADICIONADO - Verificar se pasta instances existe
        const fs = require('fs');
        const path = require('path');
        const instancesPath = path.join('.', 'instances');
        
        if (!fs.existsSync(instancesPath)) {
          fs.mkdirSync(instancesPath, { recursive: true });
          customLogger.info(`${session} - Pasta instances/ criada`);
        }

        const sessionPath = path.join(instancesPath, `${session}`);
        customLogger.whatsapp(`${session} - Caminho da sessão: ${sessionPath}`);
        
        if (fs.existsSync(sessionPath)) {
          customLogger.success(`${session} - Sessão existente encontrada, tentando carregar...`);
        } else {
          customLogger.info(`${session} - ℹ️ Nova sessão, QR Code será necessário`);
        }

        customLogger.whatsapp(`****** STARTING SESSION ${session} ******`);

        const clientOptions = HelperWhatsappWeb.getClientOptions({
          session,
          useHere,
          sessionData: null // Não usa mais dados do Firebase
        });

        // ADICIONADO - Definir authStrategy com LocalAuth para persistir sessões (sem prefixo session-)
        clientOptions.authStrategy = new LocalAuth({ 
          clientId: '', // Deixar vazio para evitar prefixo
          dataPath: path.join('./instances', session) // Pasta direta com nome da sessão
        });

        client = new Client(clientOptions);

        // ADICIONADO - Controle de QR Code timeout
        let qrTimeout;

        // MELHORADO - Sempre escuta QR Code (não usa mais sessionData)
        client.on('qr', async (qr) => {
          customLogger.whatsapp(`${session} - 📱 Novo QR Code gerado`);
          
          // IMPORTANTE - Gerar imagem base64 PRIMEIRO
          const qrCodeImage = await HelperWhatsappWeb.generateQRHooksAndEmit({ qr, req, res, session });
          
          // CORREÇÃO - Salvar a IMAGEM BASE64 no banco, não o texto
          Device.findOne({ where: { session, sessionkey } })
            .then(currentDevice => {
              const attempts = (currentDevice?.attempts || 0) + 1;
              
              return Device.update({
                state: 'QRCODE',
                status: 'qrCode',
                qrCode: qrCodeImage, // IMAGEM BASE64 em vez de texto
                attempts: attempts,
                urlCode: qr, // Texto original fica no urlCode
                updated_at: new Date()
              }, { where: { session, sessionkey } });
            })
            .then(() => {
              customLogger.success(`📊 Device atualizado com QR Code base64 - Sessão: ${session}`);
            })
            .catch(dbError => {
              customLogger.error(`❌ Erro ao atualizar device com QR Code: ${dbError.message}`);
            });
          
          // Limpar timeout anterior
          if (qrTimeout) {
            clearTimeout(qrTimeout);
          }
          
          // MELHORADO - Timeout maior para dar tempo de escanear
          qrTimeout = setTimeout(() => {
            customLogger.warning(`${session} - ⏰ QR Code expirou, mas mantendo sessão ativa...`);
          }, 120000); // 2 minutos
        });

        client.on('ready', async () => {
          customLogger.success(`${session} - 🚀 WhatsApp está pronto!`);
          
          // CRÍTICO - Cancelar timeout IMEDIATAMENTE quando conectar
          clearCurrentTimeout();
          resolved = true; // Marcar como resolvido para evitar timeout posterior
          
          // Socket.IO pode não existir (ex: quando Health Check reconecta)
          if (req?.io?.emit) {
            req.io.emit('whatsapp-status', true);
          }
          
          // ADICIONADO - Limpar qrTimeout quando conectar
          if (qrTimeout) {
            clearTimeout(qrTimeout);
            qrTimeout = null;
          }
          
          try {
            // ADICIONADO - Buscar informações completas do dispositivo (seguindo WPPConnect)
            const info = await client.info;
            const state = await client.getState();
            
            // CORRIGIDO - NÃO resetar attempts_start imediatamente
            // O reset será feito após 30 segundos de conexão estável
            // Isso evita loop infinito quando LOGOUT vem logo após CONNECTED
            await Device.update({
              state: 'CONNECTED',
              status: 'CONNECTED',
              qrCode: '',
              attempts: 0,
              // REMOVIDO: attempts_start: 0 - Não resetar aqui!
              urlCode: '',
              last_connect: new Date(),
              number: info?.wid?.user || info?.me?.user || null,
              battery: info?.battery || null,
              platform: info?.platform || 'whatsapp-web-js',
              pushname: info?.pushname || null,
              wa_version: info?.wa_version || null,
              wa_js_version: require('whatsapp-web.js/package.json').version || null,
              updated_at: new Date()
            }, { where: { session } });
            
            customLogger.database(`${session} - 📱 Informações completas do dispositivo atualizadas no banco`);
            
            // NOVO - Resetar attempts_start após 30 segundos de conexão estável
            setTimeout(async () => {
              try {
                const currentDevice = await Device.findOne({ where: { session } });
                // Só reseta se ainda estiver conectado após 30 segundos
                if (currentDevice && ['CONNECTED', 'inChat'].includes(currentDevice.status)) {
                  await Device.update({ attempts_start: 0 }, { where: { session } });
                  customLogger.success(`${session} - attempts_start resetado (conexão estável por 30s)`);
                }
              } catch (resetErr) {
                customLogger.debug(`${session} - Reset attempts_start falhou: ${resetErr.message}`);
              }
            }, 30000); // 30 segundos
            
          } catch (error) {
            customLogger.error(`${session} - ❌ Erro ao atualizar informações do dispositivo: ${error.message}`);
            // Fallback update básico - também NÃO reseta attempts_start
            Device.update({
              state: 'CONNECTED',
              status: 'CONNECTED',
              // REMOVIDO: attempts_start: 0
              updated_at: new Date(),
              last_connect: new Date()
            }, { where: { session } }).catch(err => {
              customLogger.error(`❌ Erro no fallback update: ${err.message}`);
            });
          }
          
          // Notificar sucesso
          Events.StatusMessage(req, 'CONNECTED', session);
          Sessions.addInfoSession(session, { 
            status: 'CONNECTED',
            state: 'CONNECTED',
            timestamp: Date.now()
          });

          // ADICIONADO - Resolver Promise quando estiver realmente pronto
          if (!resolved) {
            resolved = true;
            clearCurrentTimeout(); // ADICIONADO - Limpar timeout
            resolve({ status: 'CONNECTED', session });
          }
        });

        client.on('authenticated', (sessionData) => {
          customLogger.success(`${session} - 🔐 Autenticação bem-sucedida!`);
          
          // CRÍTICO - Injetar client IMEDIATAMENTE após autenticação
          // Isso garante que o client esteja disponível antes do evento 'ready'
          const sessionHelper = require('../controllers/helper/core/sessions.js');
          sessionHelper.injectClient(session, client);
          customLogger.info(`${session} - 💉 Client injetado após autenticação`);
          
          // Atualizar status no banco para indicar que está carregando
          Device.update({
            status: 'LOADING',
            state: 'AUTHENTICATED',
            updated_at: new Date()
          }, { where: { session } }).catch(() => {});
        });

        // ADICIONADO - Evento para sessão carregada de arquivo (sem QR Code)
        client.on('loading_screen', (percent, message) => {
          customLogger.debug(`${session} - 📥 ${percent}% - ${message}`);
          
          // ADICIONADO - Se chegou a 100%, provavelmente carregou sessão salva
          if (percent === 100 && message === 'WhatsApp') {
            customLogger.success(`${session} - 💾 Sessão carregada com sucesso (sem QR Code)`);
          }
        });

        // ADICIONADO - Eventos de persistência da sessão
        client.on('auth_failure', (msg) => {
          customLogger.error(`${session} - ❌ Falha na autenticação: ${msg}`);
          
          // ADICIONADO - Atualizar device no banco com erro (seguindo padrão WPPConnect)
          Device.update({
            state: 'DISCONNECTED',
            status: 'AUTH_FAIL',
            updated_at: new Date(),
            last_disconnect: new Date()
          }, { where: { session, sessionkey } }).catch(err => {
            customLogger.error(`❌ Erro ao atualizar device com AUTH_FAIL: ${err.message}`);
          });
          
          Sessions.addInfoSession(session, { 
            status: 'AUTH_FAIL',
            state: 'DISCONNECTED'
          });
          
          // ADICIONADO - Rejeitar Promise em caso de falha de auth
          if (!resolved) {
            resolved = true;
            clearCurrentTimeout(); // Limpar timeout principal
            if (qrTimeout) clearTimeout(qrTimeout); // Limpar qrTimeout
            reject(new Error(`Falha na autenticação: ${msg}`));
          }
        });

        // ADICIONADO - Detectar quando sessão é carregada
        client.on('remote_session_saved', () => {
          customLogger.success(`${session} - 💾 Sessão salva com sucesso!`);
          Sessions.addInfoSession(session, { 
            status: 'SESSION_SAVED',
            state: 'CONNECTED',
            sessionSaved: true
          });
        });

        // REMOVIDO - Eventos duplicados removidos, mantendo apenas os primeiros

        client.on('disconnected', async (reason) => {
          customLogger.warning(`${session} - 🔌 Desconectado: ${reason}`);
          
          // NOVO - Log detalhado para diagnóstico de LOGOUT imediato
          const now = new Date();
          const device = await Device.findOne({ where: { session } }).catch(() => null);
          const lastConnect = device?.last_connect ? new Date(device.last_connect) : null;
          const connectionDuration = lastConnect ? Math.round((now - lastConnect) / 1000) : 'N/A';
          
          customLogger.info(`[DISCONNECT ANALYSIS] ${session} - Reason: ${reason} | Duration: ${connectionDuration}s | attempts_start: ${device?.attempts_start || 0}`);
          
          // NOVO - Detectar LOGOUT imediato (< 10 segundos após conectar)
          if (reason === 'LOGOUT' && typeof connectionDuration === 'number' && connectionDuration < 10) {
            customLogger.error(`[⚠️ LOGOUT IMEDIATO] ${session} - Sessão caiu ${connectionDuration}s após conectar!`);
            customLogger.error(`[⚠️ DIAGNÓSTICO] ${session} - Possíveis causas: 1) Dispositivo removido no celular 2) Conflito de sessão 3) Cache corrompido`);
          }
          
          // ADICIONADO - Atualizar device no banco quando desconectado (seguindo padrão WPPConnect)
          Device.update({
            state: 'DISCONNECTED',
            status: 'disconnected',
            updated_at: new Date(),
            last_disconnect: new Date()
          }, { where: { session, sessionkey } }).catch(err => {
            customLogger.error(`❌ Erro ao atualizar device como DISCONNECTED: ${err.message}`);
          });
          
          // 🔧 WINDOWS: Tratar erro EBUSY no logout (arquivo Cookies-journal em uso)
          // Aguardar 2 segundos para Chrome liberar arquivos antes de limpar
          setTimeout(() => {
            // Limpeza será feita pelo job automático, não precisa fazer nada aqui
          }, 2000);
          
          // Se for por associação de dispositivo, limpar cache
          if (reason && reason.includes('Protocol error')) {
            customLogger.error(`${session} - 🧹 Limpando cache por erro de protocolo`);
            Sessions.addInfoSession(session, { 
              status: 'protocolError',
              reason,
              needsCleanup: true,
              timestamp: Date.now()
            });
          }
        });

        // 🔍 MELHORADO - Event para capturar mudanças de estado com mais detalhes
        client.on('change_state', async (state) => {
          customLogger.warning(`[STATE CHANGE] ${session}: ${state}`);
          
          // Atualizar estado no banco
          try {
            await Device.update({
              state: state,
              updated_at: new Date()
            }, { where: { session } });
          } catch (e) {
            // Ignorar erros de update
          }
          
          // Detectar estados problemáticos
          const problematicStates = ['CONFLICT', 'UNLAUNCHED', 'UNPAIRED', 'TIMEOUT'];
          if (problematicStates.includes(state)) {
            customLogger.error(`[⚠️ PROBLEMATIC STATE] ${session}: ${state} - Pode indicar sessão zumbi!`);
          }
        });

        customLogger.whatsapp(`${session} - 🚀 Inicializando cliente...`);
        
        // ADICIONADO - Tratamento de erro na inicialização
        try {
          await client.initialize();
        } catch (initError) {
          customLogger.error(`${session} - ❌ Erro na inicialização: ${initError.message}`);
          if (!resolved) {
            resolved = true;
            clearCurrentTimeout(); // ADICIONADO - Limpar timeout
            reject(new Error(`Erro na inicialização: ${initError.message}`));
          }
          return;
        }

        Sessions.addInfoSession(session, {
          session,
          client
        });

        Events.receiveMessage(session, client, req);
        Events.statusMessage(session, client, req);

        client.on('change_battery', (batteryInfo) => {
          const { battery, plugged } = batteryInfo;
          customLogger.debug(`${session} - 🔋 Battery: ${battery}% - Charging? ${plugged}`);
        });

        // REMOVIDO eventos duplicados (message, change_state, disconnected já tratados acima)
        client.on('message_ack', () => {});
        client.on('message_create', async (message) => {
          if (!message.fromMe) {
            // Exemplo: webhook customizado
          }
        });

        client.on('message_revoke_everyone', async (after, before) => {
          if (before) {
            // Log antes de deletar
          }
        });

        client.on('message_revoke_me', async () => {});
        client.on('media_uploaded', async () => {});
        client.on('group_update', async () => {});
      } catch (error) {
        customLogger.error(`${session} - ❌ Erro geral: ${error.message}`);
        
        // MELHORADO - Só rejeitar se ainda não foi resolvido
        if (!resolved) {
          resolved = true;
          clearCurrentTimeout(); // ADICIONADO - Limpar timeout
          reject(error);
        }
      }
    });
  }
};
