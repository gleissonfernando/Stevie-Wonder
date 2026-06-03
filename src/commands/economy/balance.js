const { SlashCommandBuilder } = require("discord.js");
const UserProfile = require("../../models/UserProfile");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Mostra seu saldo de moedas."),
  async execute(interaction) {
    if (!process.env.MONGO_URI) {
      await interaction.reply({
        content: "Economia precisa de MONGO_URI configurado no .env.",
        ephemeral: true
      });
      return;
    }

    const profile = await UserProfile.findOneAndUpdate(
      { userId: interaction.user.id, guildId: interaction.guildId },
      { $setOnInsert: { coins: 0, reputation: 0 } },
      { new: true, upsert: true }
    );

    await interaction.reply(`${interaction.user}, seu saldo e de ${profile.coins} moeda(s).`);
  }
};
