const swaggerAutogen = require('swagger-autogen')()
const config = require('./config');

const doc = {
  info: {
    version: "4.0.0",
    title: "API do WhatsApp API REST",
    description: "Permite a integração do WhatsApp com qualquer aplicação por meio de requisições POST/GET\n"
  },
  host: config?.host_ssl ?? '',
  basePath: "/",
  schemes: ['https'],
  consumes: ['application/json'],
  produces: ['application/json'],

  securityDefinitions: {
    apitoken: {
      type: "apiKey",
      in: "header",       // can be "header", "query" or "cookie"
      name: "X-API-KEY",  // name of the header, query parameter or cookie
      description: "Token de Autenticação da API..."
    }
  }
}

const outputFile = './swagger_output.json'
const endpointsFiles = ['./routers/WppConnect.js']

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
  require('./index.js')
})