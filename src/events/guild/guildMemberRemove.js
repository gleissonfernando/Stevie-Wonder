const { Events } = require("discord.js");
const { sendAuditLog } = require("../../services/discord/auditLogger");

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    await sendAuditLog(member.guild, {
      title: "Membro saiu",
      action: "member_leave",
      counter: "member_leave",
      userId: member.id,
      color: 0xf97316,
      fields: [
        { name: "Usuario", value: `${member.user.tag} (${member.id})` },
        { name: "Entrou em", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : "Desconhecido" }
      ]
    });

  }
};
