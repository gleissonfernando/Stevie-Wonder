const { Events } = require("discord.js");
const { sendAuditLog } = require("../../services/discord/auditLogger");

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban) {
    await sendAuditLog(ban.guild, {
      title: "Banimento removido",
      color: 0x22c55e,
      fields: [
        { name: "Usuario", value: `${ban.user.tag} (${ban.user.id})` }
      ]
    });
  }
};
