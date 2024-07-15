'use strict';

const sha1 = require('sha1');
const config = require('../config');

/** @type {import('sequelize-cli').Migration} */

module.exports = {

  async up (queryInterface, Sequelize) {

    const users = await queryInterface.sequelize.query(
      'SELECT * FROM users WHERE email = "admin@admin.com"',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if(users.length > 0) {
      console.log('Usuário admin já existe');
      return;
    }

    await queryInterface.bulkInsert('users', [{
      first_name: 'Administador',
      last_name: 'Manager',
      cpf: '00000000000',
      email: 'admin@admin.com',
      password: sha1(config.token),
      created_at: new Date(),
      updated_at: new Date()
    }], {});

    await queryInterface.bulkInsert('companys', [{
        company: config.company,
        logo: config.logo || 'https://upload.wikimedia.org/wikipedia/commons/f/f7/WhatsApp_logo.svg',
        default_color: '#000000',
        cnpj: '00000000000000',
        phone: '00000000000',
        cep: '00000000',
        street: 'Street Test',
        number: '000',
        complement: 'Complement Test',
        neighborhood: 'Neighborhood Test',
        city: 'City Test',
        state: 'State Test',
        cpf: '00000000000',
        email: 'admin@admin.com',
        user_id: 1,
        created_at: new Date(),
        updated_at: new Date()
    }], {});

  },

  async down (queryInterface, Sequelize) {

    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('companys', null, {});
    
  }
};
