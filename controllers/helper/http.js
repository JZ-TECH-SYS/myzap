module.exports = {
    json(res, statusCode = 200, body = {}) {
      return res.status(statusCode).json(body);
    },
  
    success(res, data = [], message = 'Sucesso') {
      return res.status(200).json({
        result: 200,
        status: 'SUCCESS',
        reason: message,
        data
      });
    },
  
    notFound(res, message = 'Não encontrado', data = []) {
      return res.status(404).json({
        result: 404,
        status: 'NOT FOUND',
        reason: message,
        data
      });
    },
  
    fail(res, error = null, statusCode = 500, reason = 'Erro inesperado') {
      return res.status(statusCode).json({
        result: statusCode,
        status: 'FAIL',
        reason,
        data: error
      });
    },
  
    invalid(res, message = 'Requisição inválida', data = null) {
      return res.status(400).json({
        result: 400,
        status: 'INVALID',
        reason: message,
        data
      });
    }
  };
  