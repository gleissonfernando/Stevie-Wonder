require("dotenv").config();

const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
const { loadCommands } = require("./services/discord/commandHandler");
const { loadEvents } = require("./services/discord/eventHandler");
const { loadComponents } = require("./services/discord/componentHandler");
const { connectDatabase } = require("./services/database/mongoose");
const { startDashboardServer } = require("./web/server");
const logger = require("./utils/logger");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember]
});

client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();
client.selectMenus = new Collection();

async function bootstrap() {
  try {
    loadCommands(client);
    loadEvents(client);
    loadComponents(client);
    client.dashboard = await startDashboardServer(client);
  } catch (error) {
    logger.error("Falha ao iniciar o dashboard", error);
    if (process.env.BOT_EXIT_ON_FAILURE !== "false") {
      process.exit(1);
    }
    return;
  }

  try {
    await connectDatabase();
  } catch (error) {
    logger.error("Falha ao conectar o MongoDB. O dashboard continua online.", error);
  }

  const token = process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN;

  if (!token || token.includes("coloque_")) {
    logger.error("Configure DISCORD_TOKEN ou DISCORD_BOT_TOKEN no arquivo .env.");
    if (!client.dashboard && process.env.BOT_EXIT_ON_FAILURE !== "false") {
      process.exit(1);
    }
    return;
  }

  try {
    await client.login(token);
  } catch (error) {
    logger.error("Falha ao conectar o bot ao Discord. O dashboard continua online.", error);
    if (!client.dashboard && process.env.BOT_EXIT_ON_FAILURE !== "false") {
      process.exit(1);
    }
  }
}

bootstrap();
