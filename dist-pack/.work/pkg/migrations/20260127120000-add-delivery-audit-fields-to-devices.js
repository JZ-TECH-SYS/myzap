'use strict';

/**
 * Migration para adicionar campos de auditoria de entrega de mensagens.
 * 
 * Estes campos permitem rastrear a saúde real das sessões:
 * - Quando foi o último envio bem sucedido?
 * - Quando foi a última mensagem recebida?
 * - Quantas falhas de envio consecutivas?
 * - Qual o status real do health check?
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar quais colunas já existem
    const tableInfo = await queryInterface.describeTable('Devices');
    
    const columnsToAdd = [
      { name: 'last_message_sent', type: Sequelize.DATE, comment: 'Último envio bem sucedido' },
      { name: 'last_message_received', type: Sequelize.DATE, comment: 'Última msg recebida' },
      { name: 'send_failure_count', type: Sequelize.INTEGER, defaultValue: 0, comment: 'Falhas consecutivas de envio' },
      { name: 'last_send_error', type: Sequelize.TEXT, comment: 'Último erro de envio' },
      { name: 'last_health_check', type: Sequelize.DATE, comment: 'Último health check OK' },
      { name: 'health_status', type: Sequelize.STRING, defaultValue: 'UNKNOWN', comment: 'HEALTHY, WARNING, ZOMBIE, UNKNOWN' },
      { name: 'last_auto_recovery', type: Sequelize.DATE, comment: 'Última tentativa de recuperação' },
      { name: 'last_recovery_reason', type: Sequelize.TEXT, comment: 'Motivo da última recuperação' },
      { name: 'recovery_count_24h', type: Sequelize.INTEGER, defaultValue: 0, comment: 'Recuperações nas últimas 24h' }
    ];

    for (const col of columnsToAdd) {
      if (!tableInfo[col.name]) {
        await queryInterface.addColumn('Devices', col.name, {
          type: col.type,
          allowNull: true,
          defaultValue: col.defaultValue || null
        });
        console.log(`  ✅ Coluna ${col.name} adicionada`);
      } else {
        console.log(`  ⏭️ Coluna ${col.name} já existe`);
      }
    }

    console.log('✅ Migration concluída: Campos de auditoria de entrega adicionados');
  },

  async down(queryInterface, Sequelize) {
    const columnsToRemove = [
      'last_message_sent',
      'last_message_received', 
      'send_failure_count',
      'last_send_error',
      'last_health_check',
      'health_status',
      'last_auto_recovery',
      'last_recovery_reason',
      'recovery_count_24h'
    ];

    for (const column of columnsToRemove) {
      try {
        await queryInterface.removeColumn('Devices', column);
        console.log(`  ✅ Coluna ${column} removida`);
      } catch (e) {
        console.log(`  ⏭️ Coluna ${column} não existe ou já foi removida`);
      }
    }

    console.log('✅ Migration revertida: Campos de auditoria removidos');
  }
};
