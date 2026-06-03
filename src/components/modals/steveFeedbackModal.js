const logger = require("../../utils/logger");

module.exports = {
  customId: "steve_feedback_modal",
  async execute(interaction) {
    const message = interaction.fields.getTextInputValue("message");
    logger.info(`Feedback de ${interaction.user.tag}: ${message}`);

    await interaction.reply({
      content: "Feedback recebido. Obrigado!",
      ephemeral: true
    });
  }
};
