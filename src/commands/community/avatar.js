const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Mostra o avatar de um usuario.")
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Usuario para ver o avatar.")
        .setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getUser("usuario") || interaction.user;
    const avatar = user.displayAvatarURL({ size: 1024 });

    await interaction.reply({
      content: `Avatar de ${user}: ${avatar}`
    });
  }
};
