module.exports = {
  customId: "steve_help",
  async execute(interaction) {
    await interaction.reply({
      content: "Comandos disponiveis: /ping, /avatar, /panel, /clear, /say, /balance.",
      ephemeral: true
    });
  }
};
