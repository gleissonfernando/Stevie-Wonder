const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");
const { ensureServerStructure } = require("../../services/discord/serverSetup");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ativar")
    .setDescription("Organiza o servidor automaticamente para comunidade de streamer.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({ content: "Use este comando dentro de um servidor.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await ensureServerStructure(interaction.guild, { cleanup: true });

    await interaction.editReply({
      content: [
        "✅ Sistema ativado e servidor organizado.",
        `Categorias verificadas: ${result.categories}`,
        `Canais obrigatorios verificados: ${result.channels}`,
        `Cargos obrigatorios verificados: ${result.roles}`
      ].join("\n")
    });
  }
};
