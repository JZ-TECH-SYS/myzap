'use strict';

const sha1 = require('sha1');
const config = require('../config');

/** @type {import('sequelize-cli').Migration} */

module.exports = {

  async up (queryInterface, Sequelize) {

    const users = await queryInterface.sequelize.query(
      'SELECT * FROM users WHERE email = "jz.tech.digital@gmail.com"',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if(users.length > 0) {
      console.log('Usuário admin já existe');
      return;
    }

    await queryInterface.bulkInsert('users', [{
      first_name: 'João Vitor',
      last_name: 'Nacimetno',
      cpf: '11269140965',
      email: 'jz.tech.digital@gmail.com',
      password: sha1(config.token),
      created_at: new Date(),
      updated_at: new Date()
    }], {});

    await queryInterface.bulkInsert('companys', [{
        company: config.company,
        logo: config.logo || 'https://upload.wikimedia.org/wikipedia/commons/f/f7/WhatsApp_logo.svg',
        default_color: '#000000',
        cnpj: '37598817000113',
        phone: '44997633866',
        cep: '87485000',
        street: 'Rua dina moura',
        number: '109',
        complement: 'Centro',
        neighborhood: 'Centro',
        city: 'Douradina',
        state: 'Paraná',
        cpf: '11269140965',
        email: 'jz.tech.digital@gmail.com',
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
