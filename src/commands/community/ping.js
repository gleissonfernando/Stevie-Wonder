const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Mostra a latencia do bot."),
  async execute(interaction) {
    const sent = await interaction.reply({ content: "Calculando...", fetchReply: true });
    const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;

    await interaction.editReply(`Pong! Latencia: ${roundTrip}ms | WebSocket: ${interaction.client.ws.ping}ms`);
  }
};
