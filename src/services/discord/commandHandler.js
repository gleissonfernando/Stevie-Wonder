const path = require("path");
const { getJsFiles } = require("./fileLoader");
const logger = require("../../utils/logger");

function loadCommands(client) {
  const commandsPath = path.join(process.cwd(), "src", "commands");
  const commandFiles = getJsFiles(commandsPath);

  for (const file of commandFiles) {
    delete require.cache[require.resolve(file)];
    const command = require(file);

    if (!command.data?.name || typeof command.execute !== "function") {
      logger.warn(`Comando ignorado por formato invalido: ${file}`);
      continue;
    }

    client.commands.set(command.data.name, command);
  }

  logger.info(`${client.commands.size} comando(s) carregado(s).`);
}

module.exports = {
  loadCommands
};
