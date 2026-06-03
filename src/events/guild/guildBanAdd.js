const { Events } = require("discord.js");
const { sendAuditLog } = require("../../services/discord/auditLogger");

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    await sendAuditLog(ban.guild, {
      title: "Membro banido",
      color: 0xef4444,
      fields: [
        { name: "Usuario", value: `${ban.user.tag} (${ban.user.id})` },
        { name: "Motivo", value: ban.reason || "Nao informado." }
      ]
    });
  }
};
