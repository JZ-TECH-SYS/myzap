const SessionsHelper = require('./helper/sessions.js');
const http = require('./helper/http.js');
const chalk = require('chalk');
const customLogger = require('../util/customLogger.js'); // ✅ Logger padronizado

class Sessions {
  static async instances(req, res) {
    try {
      const sessions = await SessionsHelper.listDevices();
      return http.success(res, sessions);
    } catch (err) {
      return http.fail(res, err, 400, 'Erro ao buscar instâncias');
    }
  }

  static async createClient(session, req, wppconnect = {}) {
    const sessionkey = req.headers['sessionkey'];
    const device = await SessionsHelper.getDevice(session, sessionkey);

    if (device && wppconnect?.session !== session) {
      customLogger.error(`❌ CLIENT INJECTED, SESSION INVALID - ${session} / ${sessionkey}`);
      return false;
    }

    if (device && wppconnect?.session === session) {
      SessionsHelper.injectClient(session, wppconnect);
      customLogger.success(`� CLIENT INJECTED - ${session} / ${sessionkey}`);
      return true;
    }

    customLogger.error(`❌ CLIENT INJECTED, SESSION INVALID - ${session} / ${sessionkey}`);
    return false;
  }

  static async addInfoSession(session, data) {
    try {
      customLogger.info(`[ADD INFO SESSION] ${session} - Adicionando informações da sessão`);
      
      // Injetar o client se fornecido
      if (data.client) {
        SessionsHelper.injectClient(session, data.client);
        customLogger.info(`[CLIENT INJECTED] ${session} - Cliente injetado com sucesso`);
      }

      // Salvar dados adicionais no helper se necessário
      if (data.tokens) {
        customLogger.info(`[TOKENS SAVED] ${session} - Tokens salvos`);
      }

      if (data.status) {
        customLogger.info(`[STATUS UPDATE] ${session} - Status: ${data.status}`);
      }

      if (data.qrCode) {
        customLogger.info(`[QR CODE] ${session} - QR Code atualizado`);
      }

      return true;
    } catch (error) {
      customLogger.error(`[ADD INFO SESSION ERROR] ${session} - ${error.message}`);
      return false;
    }
  }

  static async getClient(session) {
    return await SessionsHelper.getSessionWithClient(session);
  }

  // ✅ ADICIONADO - Função getSession para compatibilidade com código existente
  static getSession(session) {
    try {
      // Retorna client injetado diretamente (igual ao comportamento esperado)
      const injectedClient = SessionsHelper.getInjectedClient(session);
      
      if (injectedClient) {
        return { client: injectedClient };
      }
      
      customLogger.warning(`⚠️ Cliente não encontrado na memória para sessão: ${session}`);
      return null;
    } catch (error) {
      customLogger.error(`❌ Erro ao buscar sessão ${session}: ${error.message}`);
      return null;
    }
  }

  static async getAllSessions(req, res) {
    try {
      const sessions = await SessionsHelper.listDevices();

      if (!sessions.length) {
        return http.notFound(res, 'Nenhuma sessão encontrada!', sessions);
      }

      return http.success(res, sessions, 'Sessões encontradas com sucesso!');
    } catch (err) {
      return http.fail(res, err, 400, 'Erro ao buscar sessões');
    }
  }

  static async getConnectionStatus(req, res) {
    try {
      const session = req.body.session;
      const device = await SessionsHelper.getDevice(req.body.session, req.headers['sessionkey']);

      // Status que indicam conexão ativa
      const connectedStatuses = ['inChat', 'CONNECTED', 'isLogged', 'isConnected'];
      
      // Status que permitem reconexão automática (celular ainda conectado)
      const reconnectableStatuses = ['browserClose', 'serverClose', 'autocloseCalled'];

      if (connectedStatuses.includes(device?.status)) {
        return http.json(res, 200, {
          result: 200,
          status: device.status,
          state: 'CONNECTED',
          data: device
        });
      }

      if (device?.status === 'qrCode') {
        // Mostrar QR Code no terminal para leitura com celular
        if (device.qrCode) {
          try {
            const qr = require('qrcode-terminal');
            console.log(chalk.cyan(`\n📱 QR CODE para sessão: ${req.body.session}`));
            console.log(chalk.yellow('═'.repeat(50)));
            qr.generate(device.urlCode,{small: true});
            console.log(chalk.yellow('═'.repeat(50)));
            console.log(chalk.green('👆 Escaneie o QR Code acima com seu celular!'));
            console.log(chalk.gray(`Sessão: ${req.body.session} | Status: ${device.status}\n`));
          } catch (err) {
            console.log(chalk.red(`❌ Erro ao exibir QR Code no terminal: ${err.message}`));
            console.log(chalk.cyan(`QR Code disponível para sessão: ${req.body.session}`));
          }
        }
        
        return http.json(res, 200, {
          result: 200,
          status: device.status,
          state: 'QRCODE',
          data: device
        });
      }

      // ✅ VERIFICAR SE ESTÁ INICIALIZANDO (status INITIALIZING mas sem QR ainda)
      if (device?.status === 'INITIALIZING') {
        return http.json(res, 200, {
          result: 200,
          status: 'INITIALIZING',
          state: 'STARTING',
          message: 'Sessão está sendo inicializada. Aguarde...',
          data: device
        });
      }

      // Tentar reconexão automática para status recuperáveis
      if (reconnectableStatuses.includes(device?.status)) {
        customLogger.info(`[RECONNECT ATTEMPT] ${req.body.session} - Status: ${device?.status}`);
        
        try {
          // Tentar reconectar através do engine específico
          await Sessions.attemptReconnection(req.body.session, req);
          
          return http.json(res, 200, {
            result: 200,
            status: 'RECONNECTING',
            state: 'RECONNECTING',
            message: 'Tentando reconectar automaticamente...',
            data: device
          });
        } catch (reconnectError) {
          customLogger.error(`[RECONNECT FAILED] ${req.body.session} - ${reconnectError.message}`);
          
          return http.json(res, 200, {
            result: 200,
            status: device?.status,
            state: 'DISCONNECTED',
            message: 'Reconexão automática falhou. QR Code necessário.',
            needsQR: true,
            data: device
          });
        }
      }

      return http.invalid(res, 'Sessão não está em chat', device);

    } catch (err) {
      customLogger.error(`[ERROR GET CONNECTION STATUS] ${req.body.session}`);
      return http.fail(res, err, 500, 'Erro ao verificar status da conexão');
    }
  }

  static async deleteSession(req, res) {
    try {
      const session = req.body.session;
      const data = await Sessions.getClient(session);
      if (!data) return http.notFound(res, 'Sessão não encontrada!');

      const { logout, close } = await SessionsHelper.fecharSessaoComLogout(data, session);
      await SessionsHelper.deleteSessionAndCleanup(session);

      return http.success(res, { logout, close }, 'Sessão Fechada com sucesso');
    } catch (err) {
      return http.fail(res, err, 500, 'Erro ao deletar sessão!');
    }
  }

  static async attemptReconnection(session, req) {
    const config = require('../config');
    const engine = config.engine;

    customLogger.info(`[RECONNECT] Tentando reconectar sessão ${session} no engine ${engine}`);

    try {
      switch (engine) {
        case '1': // WhatsApp WebJS
          return await Sessions.reconnectWhatsappWebJS(session, req);
          
        case '2': // WppConnect  
          return await Sessions.reconnectWppConnect(session, req);
          
        case '3': // Venom
          return await Sessions.reconnectVenom(session, req);
          
        default:
          throw new Error(`Engine ${engine} não suportado para reconexão`);
      }
    } catch (error) {
      customLogger.error(`[RECONNECT ERROR] ${session} - ${error.message}`);
      throw error;
    }
  }

  static async reconnectWhatsappWebJS(session, req) {
    const data = await Sessions.getClient(session);
    if (!data?.client) throw new Error('Cliente não encontrado');

    // WhatsApp WebJS tem reconexão automática no evento disconnected
    // Forçar inicialização se necessário
    if (data.client.initialize) {
      await data.client.initialize();
      customLogger.info(`[RECONNECT] WhatsApp WebJS ${session} - initialize() chamado`);
      return true;
    }
    
    throw new Error('Método de reconexão não disponível');
  }

  static async reconnectWppConnect(session, req) {
    const data = await Sessions.getClient(session);
    if (!data?.client) throw new Error('Cliente não encontrado');
    const client = data.client;
    if (!client.getConnectionState) {
      throw new Error('Método de verificação de estado não disponível');
    }
    const state = await client.getConnectionState();
    customLogger.info(`[RECONNECT] WppConnect ${session} - Estado atual: ${state}`);

    // Se o telefone foi desvinculado, não há tokens válidos e um novo QR é necessário.
    if (state === 'UNPAIRED') {
      throw new Error('Dispositivo não pareado - QR Code necessário');
    }

    // Tenta reivindicar a sessão nesta máquina
    if (client.useHere) {
      await client.useHere().catch(() => {});
    }
    // Reinicia o watchdog para forçar verificação periódica
    if (client.startPhoneWatchdog) {
      await client.startPhoneWatchdog(15000).catch(() => {});
    }

    // Espera alguns segundos e verifica se a sessão voltou a ficar conectada
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const newState = await client.getConnectionState();
    if (newState && newState !== 'UNPAIRED') {
      customLogger.success(`[RECONNECT] WppConnect ${session} - Reconectado (state=${newState})`);
      return true;
    }

    // Se ainda não reconectou, fecha a instância e cria de novo usando o token salvo em disco
    if (client.close) {
      await client.close().catch(() => {});
    }
    const WppEngine = require('../engines/WppConnect.js');
    // Cria uma nova sessão. O token armazenado em instances/<session> será reutilizado.
    await WppEngine.initSession(req, null);
    return true;
  }

  static async reconnectVenom(session, req) {
    const data = await Sessions.getClient(session);
    if (!data?.client) throw new Error('Cliente não encontrado');

    customLogger.info(`[RECONNECT] Venom ${session} - Tentando reconexão baseada na documentação oficial`);
    
    try {
      // Baseado na documentação do Venom, verificar se cliente ainda está ativo
      if (data.client.isConnected) {
        const isConnected = await data.client.isConnected();
        customLogger.info(`[RECONNECT] Venom ${session} - Status conectado: ${isConnected}`);
        
        if (isConnected) {
          return true; // Já está conectado
        }
      }

      // Tentar usar getConnectionState se disponível (algumas versões têm)
      if (data.client.getConnectionState) {
        const state = await data.client.getConnectionState();
        customLogger.info(`[RECONNECT] Venom ${session} - Estado: ${state}`);
        
        // Estados reconectáveis baseados na documentação
        const reconnectableStates = ['DISCONNECTED', 'SYNCING', 'RESUMING'];
        if (reconnectableStates.includes(state)) {
          // Venom pode precisar reinicializar a sessão
          return await Sessions.restartVenomSession(session, req);
        }
      }

      // Última tentativa: verificar se podemos usar restartService
      if (data.client.restartService) {
        await data.client.restartService();
        customLogger.info(`[RECONNECT] Venom ${session} - restartService() executado`);
        return true;
      }

      // Se nenhum método funcionou, precisará de QR Code
      throw new Error('Venom: Métodos de reconexão esgotados - QR Code necessário');
      
    } catch (error) {
      customLogger.error(`[RECONNECT] Venom ${session} - Erro: ${error.message}`);
      throw new Error(`Venom: Falha na reconexão - ${error.message}`);
    }
  }

  static async restartVenomSession(session, req) {
    try {
      customLogger.info(`[RESTART] Venom ${session} - Iniciando restart da sessão`);
      
      // Fechar sessão atual primeiro
      const data = await Sessions.getClient(session);
      if (data?.client?.close) {
        await data.client.close();
        customLogger.info(`[RESTART] Venom ${session} - Sessão anterior fechada`);
      }

      // Pequena pausa para garantir limpeza
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Tentar recriar a sessão usando o método do engine
      const engine = require('../engines/Venom.js');
      const result = await engine.reconnect(session, req, null);
      
      if (result) {
        customLogger.info(`[RESTART] Venom ${session} - Nova sessão criada com sucesso`);
        return true;
      } else {
        throw new Error('Falha ao recriar sessão');
      }
      
    } catch (error) {
      customLogger.error(`[RESTART] Venom ${session} - Falha: ${error.message}`);
      throw new Error(`Restart falhou: ${error.message}`);
    }
  }

  static async forceReconnect(req, res) {
    try {
      const session = req.body.session;
      const data = await Sessions.getClient(session);
      
      if (!data) {
        return http.notFound(res, 'Sessão não encontrada!');
      }

      customLogger.info(`[FORCE RECONNECT] Tentativa manual para sessão ${session}`);

      try {
        await Sessions.attemptReconnection(session, req);
        
        return http.success(res, {
          session,
          status: 'RECONNECTING',
          message: 'Reconexão iniciada com sucesso'
        }, 'Tentativa de reconexão iniciada');
        
      } catch (reconnectError) {
        customLogger.error(`[FORCE RECONNECT FAILED] ${session} - ${reconnectError.message}`);
        
        return http.json(res, 400, {
          result: 400,
          status: 'RECONNECT_FAILED',
          session,
          message: reconnectError.message,
          needsQR: reconnectError.message.includes('QR Code')
        });
      }

    } catch (err) {
      customLogger.error(`[FORCE RECONNECT ERROR] ${req.body.session} - ${err.message}`);
      return http.fail(res, err, 500, 'Erro ao tentar reconectar');
    }
  }

  // ✅ ADICIONADO - Método para reparar sessão com problemas de associação
  static async repairSession(req, res) {
    try {
      const session = req.body.session;
      
      if (!session) {
        return http.fail(res, 'Sessão não informada', 400, 'Sessão obrigatória');
      }

      customLogger.info(`[REPAIR SESSION] Reparando sessão ${session}`);

      // Verificar se é WhatsApp WebJS
      const config = require('../config');
      
      if (config.engine === '1') {
        // WhatsApp WebJS
        const HelperWhatsappWeb = require('../engines/helper/wweb.js');
        await HelperWhatsappWeb.repairSession(session);
        
        customLogger.info(`[REPAIR SESSION] ${session} - Cache WhatsApp WebJS limpo`);
      }
      
      // Limpar sessão do banco também
      await SessionsHelper.deleteSessionAndCleanup(session);
      
      return http.success(res, {
        session,
        status: 'REPAIRED',
        message: 'Sessão reparada com sucesso. Tente conectar novamente.',
        nextStep: 'Inicie uma nova conexão'
      }, 'Sessão reparada com sucesso');

    } catch (err) {
      customLogger.error(`[REPAIR SESSION ERROR] ${req.body.session} - ${err.message}`);
      return http.fail(res, err, 500, 'Erro ao reparar sessão');
    }
  }

  /**
   * Remove sessão da memória sem precisar de req/res
   * Método seguro para uso em reconexões automáticas
   */
  static removeSessionFromMemory(session) {
    try {
      if (Sessions.client[session]) {
        // Tentar fechar client se existir
        if (Sessions.client[session].client && typeof Sessions.client[session].client.close === 'function') {
          Sessions.client[session].client.close().catch(() => {});
        }
        
        // Remover da memória
        delete Sessions.client[session];
        customLogger.info(`[SESSIONS] Sessão ${session} removida da memória`);
      }
    } catch (error) {
      customLogger.warning(`[SESSIONS] Erro ao remover sessão ${session} da memória:`, error.message);
    }
  }
}

module.exports = Sessions;
