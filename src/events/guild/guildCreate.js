const { Events } = require("discord.js");
const logger = require("../../utils/logger");

module.exports = {
  name: Events.GuildCreate,
  execute(guild) {
    logger.info(`Entrei no servidor ${guild.name} (${guild.id}).`);
  }
};
