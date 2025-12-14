const request = require('request-promise');
const axios = require('axios');
const config = require('./config');
const logger = require('./util/logger');
const customLogger = require('./util/customLogger');

const { exec } = require('child_process');

const chalk = require('chalk');

const DeviceModel = require('./Models/device');
const Device = DeviceModel(config.sequelize);

// 🚀 JOBS DE LIMPEZA AUTOMÁTICA
const { startCacheCleanupJob } = require('./jobs/cacheCleanup');
const { startChatHistoryCleanupJob } = require('./jobs/chatHistoryCleanup');
const { startInstancesCleanupJob } = require('./jobs/instancesCleanup');
const { startDatabaseCleanupJob } = require('./jobs/databaseCleanup');
const { startLogsCleanupJob } = require('./jobs/logsCleanup');
const { startMemoryMonitorJob } = require('./jobs/memoryMonitor');
const { startInstanceMetricsJob } = require('./jobs/instanceMetrics'); // 📊 Métricas por instância

async function startAllSessions() {

	const host = config?.host ? `${config?.host}:${config?.port}` : config?.host_ssl;
	const sessions = await Device.findAll();

	if (sessions != null) {
		
        // update all devices without where
        await Device.update({
			
			qrCode: '',
			attempts: 0,
			urlCode: '',
			attempts_start: 0,
			last_start: 'NULL',

			state: 'DISCONNECTED',
			status: 'notLogged',
			
			updated_at: new Date()
		}, { where: {} });

		logger.info(`Iniciando ${sessions.length} sessões...`);

		async function startSession(object) {

			const sessionData = {
				...object.dataValues,
				apitoken: config.token,
			}

			try {

				await axios.post(`${host}/start`, {
					session: sessionData.session,
					wh_connect: sessionData.wh_connect,
					wh_qrcode: sessionData.wh_qrcode,
					wh_status: sessionData.wh_status,
					wh_message: sessionData.wh_message,
					AutoRejectCall: sessionData.AutoRejectCall,
					AnswerMissedCall: sessionData.AnswerMissedCall
				}, {
					headers: {
						apitoken: sessionData.apitoken,
						sessionkey: sessionData.sessionkey
					}
				});
		
				console.log(chalk.green(`[SESSION] ${chalk.bold.green(sessionData.session)} - ${chalk.bold.green(`Iniciada com sucesso!`)}`));

			} catch (error) {
				console.log(error);
			}
		}

		for (let i = 0; i < sessions.length; i++) {

			sessionData = sessions[i];
			await startSession(sessionData);

			if (i < sessions.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds
			}

		}

	}else{
		//clear instances folder
		exec('rm -rf ./instances/*', (err) => {
			if (err) {
				console.error("Erro ao apagar instances folder:", err);
			}
		});

	}
}

// 🚀 Iniciar jobs de limpeza automática
function startCleanupJobs() {
	try {
		customLogger.info('🚀 Iniciando jobs de limpeza automática...');
		
		startCacheCleanupJob();
		startChatHistoryCleanupJob();
		startInstancesCleanupJob();
		startDatabaseCleanupJob();
		startLogsCleanupJob();
		startMemoryMonitorJob();
		startInstanceMetricsJob(); // 📊 Métricas por instância
		
		customLogger.success('✅ Todos os jobs de limpeza foram iniciados com sucesso!');
	} catch (err) {
		customLogger.error(`❌ Erro ao iniciar jobs de limpeza: ${err.message}`);
	}
}

module.exports.startAllSessions = startAllSessions;
module.exports.startCleanupJobs = startCleanupJobs;
