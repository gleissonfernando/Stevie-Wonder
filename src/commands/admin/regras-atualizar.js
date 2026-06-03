const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");
const { ensureRulesPanel, RULES_CHANNEL_ID } = require("../../services/discord/rulesPanel");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("regras-atualizar")
    .setDescription("Atualiza o painel de regras existente.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "Use este comando dentro de um servidor.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const message = await ensureRulesPanel(client, { updateExisting: true });

    await interaction.editReply({
      content: `Painel de regras atualizado em <#${RULES_CHANNEL_ID}>: ${message.url}`
    });
  }
};
