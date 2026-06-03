require("dotenv").config();

const { REST, Routes } = require("discord.js");
const path = require("path");
const { getJsFiles } = require("./fileLoader");
const logger = require("../../utils/logger");

async function deployCommands() {
  const commands = [];
  const commandsPath = path.join(process.cwd(), "src", "commands");

  for (const file of getJsFiles(commandsPath)) {
    const command = require(file);
    if (command.data?.toJSON) {
      commands.push(command.data.toJSON());
    }
  }

  const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

  if (!DISCORD_TOKEN || !CLIENT_ID) {
    throw new Error("Configure DISCORD_TOKEN e CLIENT_ID no .env.");
  }

  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, { body: commands });
  logger.info(`${commands.length} slash command(s) registrado(s).`);
}

deployCommands().catch((error) => {
  logger.error("Falha ao registrar comandos", error);
  process.exit(1);
});
