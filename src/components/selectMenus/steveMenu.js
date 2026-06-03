module.exports = {
  customId: "steve_menu",
  async execute(interaction) {
    const selected = interaction.values[0];
    const labels = {
      community: "comandos de comunidade",
      moderation: "ferramentas de moderacao",
      economy: "sistema de economia"
    };

    await interaction.reply({
      content: `Voce selecionou ${labels[selected] || selected}.`,
      ephemeral: true
    });
  }
};
