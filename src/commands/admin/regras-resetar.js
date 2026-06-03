const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");
const { resetRulesPanel, RULES_CHANNEL_ID } = require("../../services/discord/rulesPanel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("regras-resetar")
    .setDescription("Apaga o registro antigo e envia um novo painel de regras.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "Use este comando dentro de um servidor.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const message = await resetRulesPanel(client);

    await interaction.editReply({
      content: `Registro resetado e novo painel enviado em <#${RULES_CHANNEL_ID}>: ${message.url}`
    });
  }
};
