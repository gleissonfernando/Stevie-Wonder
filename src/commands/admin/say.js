const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("Faz o bot enviar uma mensagem.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("mensagem")
        .setDescription("Mensagem que sera enviada.")
        .setRequired(true)
    ),
  async execute(interaction) {
    const message = interaction.options.getString("mensagem", true);
    await interaction.reply({ content: "Mensagem enviada.", ephemeral: true });
    await interaction.channel.send(message);
  }
};
