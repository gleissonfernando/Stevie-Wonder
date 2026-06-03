const { PermissionFlagsBits, SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Apaga mensagens recentes do canal.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("quantidade")
        .setDescription("Quantidade de mensagens, entre 1 e 100.")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),
  async execute(interaction) {
    const amount = interaction.options.getInteger("quantidade", true);
    const deleted = await interaction.channel.bulkDelete(amount, true);

    await interaction.reply({
      content: `${deleted.size} mensagem(ns) apagada(s).`,
      ephemeral: true
    });
  }
};
