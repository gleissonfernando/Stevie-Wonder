const { ActivityType, Events } = require("discord.js");
const { ensureRulesPanel } = require("../../services/discord/rulesPanel");
const { emitGuildStats } = require("../../services/discord/dashboardSync");
const logger = require("../../utils/logger");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    client.user.setActivity("Steve Wonder", { type: ActivityType.Watching });
    logger.info(`Bot online como ${client.user.tag}.`);

    try {
      await ensureRulesPanel(client, { updateExisting: true });
    } catch (error) {
      logger.error("Falha ao garantir o painel de regras", error);
    }

    for (const guild of client.guilds.cache.values()) {
      emitGuildStats(guild).catch((error) => {
        logger.warn(`Nao foi possivel emitir estatisticas de ${guild.id}: ${error.message}`);
      });
    }
  }
};
