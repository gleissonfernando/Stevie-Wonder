require("dotenv").config();

const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");
const { loadCommands } = require("./services/discord/commandHandler");
const { loadEvents } = require("./services/discord/eventHandler");
const { loadComponents } = require("./services/discord/componentHandler");
const { connectDatabase } = require("./services/database/mongoose");
const { startDashboardSocket } = require("./services/socketClient/dashboardSocket");
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
    await connectDatabase();

    if (!process.env.DISCORD_TOKEN || process.env.DISCORD_TOKEN.includes("coloque_")) {
      throw new Error("Configure DISCORD_TOKEN no arquivo .env.");
    }

    await client.login(process.env.DISCORD_TOKEN);
    client.dashboardSocket = startDashboardSocket(client);
  } catch (error) {
    logger.error("Falha ao iniciar o bot", error);
    process.exit(1);
  }
}

bootstrap();
