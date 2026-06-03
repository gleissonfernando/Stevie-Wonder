const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} = require("discord.js");
const { baseEmbed } = require("../../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Envia um painel de exemplo com componentes."),
  async execute(interaction) {
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("steve_help")
        .setLabel("Ajuda")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("steve_feedback")
        .setLabel("Feedback")
        .setStyle(ButtonStyle.Secondary)
    );

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("steve_menu")
        .setPlaceholder("Escolha uma opcao")
        .addOptions(
          { label: "Comunidade", value: "community" },
          { label: "Moderacao", value: "moderation" },
          { label: "Economia", value: "economy" }
        )
    );

    await interaction.reply({
      embeds: [baseEmbed("Steve Wonder", "Painel inicial do bot.")],
      components: [buttons, menu]
    });
  }
};
