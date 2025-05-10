const { exec } = require("child_process");

class ServerController {
  //update
  static async update(req, res) {
    try {
      exec("bash ./scripts/update.sh", (error, stdout, stderr) => {
        if (error) {
          console.error(`Erro ao executar o comando: ${error}`);
          return res.status(500).json({
            success: false,
            message: "Erro interno do servidor ao executar o comando.",
            output: error,
          });
        }
        console.log(`Saída do comando: ${stdout}`);
        res.json({
          success: true,
          message: "Comando executado com sucesso.",
          output: stdout,
        });
      });
    } catch (error) {
      console.error(`Erro ao executar o comando: ${error}`);
      return res.status(500).json({
        success: false,
        message: "Erro interno do servidor ao executar o comando.",
        output: error,
      });
    }
  }

  static async command(req, res) {
    try {
      // Obtenha os parâmetros do corpo da solicitação
      const { command } = req.body;

      // Verifique se os parâmetros necessários foram fornecidos
      if (!command) {
        return res.status(400).json({
          success: false,
          message: "Parâmetros inválidos.",
          output: 'O parâmetro "command" é obrigatório.',
        });
      }

      if (command != "bash ./scripts/update.sh") {
        return res.status(400).json({
          success: false,
          message: "Comando inválido.",
          output: 'O comando deve ser "bash ./scripts/update.sh".',
        });
      }

      // Execute o comando
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Erro ao executar o comando: ${error}`);
          return res.status(500).json({
            success: false,
            message: "Erro interno do servidor ao executar o comando.",
            output: error,
          });
        }
        console.log(`Saída do comando: ${stdout}`);
        res.json({
          success: true,
          message: "Comando executado com sucesso.",
          output: stdout,
        });
      });
    } catch (error) {
      console.error(`Erro ao executar o comando: ${error}`);
      return res.status(500).json({
        success: false,
        message: "Erro interno do servidor ao executar o comando.",
        output: error,
      });
    }
  }
}

module.exports = ServerController;
