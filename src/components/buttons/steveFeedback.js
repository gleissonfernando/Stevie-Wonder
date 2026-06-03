const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

module.exports = {
  customId: "steve_feedback",
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId("steve_feedback_modal")
      .setTitle("Enviar feedback");

    const input = new TextInputBuilder()
      .setCustomId("message")
      .setLabel("O que voce achou?")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  }
};
