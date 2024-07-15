'use strict';

const config = require('../config');

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up (queryInterface, Sequelize) {

    const configurations = await queryInterface.sequelize.query(
      'SELECT * FROM configurations',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if(configurations.length > 0) {
      console.log('Configuração já existe');
      return;
    }

    await queryInterface.bulkInsert('configurations', [{
        port: '3333',
        host: '',
        host_ssl: config.host_ssl,
        company: 'Company',
        logo: config.logo || 'https://upload.wikimedia.org/wikipedia/commons/f/f7/WhatsApp_logo.svg',
        version: '0.0.1',
        cors_origin: '*',
        time_typing: config.time_typing || 300,
        
        created_at: new Date(),
        updated_at: new Date()
    }], {});
    
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('configurations', null, {});
  }
};
