const { Events } = require("discord.js");
const logger = require("../../utils/logger");

async function runComponent(interaction, collection) {
  const component = collection.get(interaction.customId) || collection.get(interaction.customId.split(":")[0]);
  if (!component) return false;

  await component.execute(interaction, interaction.client);
  return true;
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction, client);
        return;
      }

      if (interaction.isButton()) {
        await runComponent(interaction, client.buttons);
        return;
      }

      if (interaction.isModalSubmit()) {
        await runComponent(interaction, client.modals);
        return;
      }

      if (interaction.isStringSelectMenu()) {
        await runComponent(interaction, client.selectMenus);
      }
    } catch (error) {
      logger.error("Erro ao processar interacao", error);

      const payload = {
        content: "Ocorreu um erro ao executar essa acao.",
        ephemeral: true
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  }
};
