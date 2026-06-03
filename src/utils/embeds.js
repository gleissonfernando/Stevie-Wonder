const { EmbedBuilder } = require("discord.js");
const config = require("../config/config");

function baseEmbed(title, description, color = config.colors.primary) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

module.exports = {
  baseEmbed,
  successEmbed: (title, description) => baseEmbed(title, description, config.colors.success),
  warningEmbed: (title, description) => baseEmbed(title, description, config.colors.warning),
  errorEmbed: (title, description) => baseEmbed(title, description, config.colors.danger)
};
