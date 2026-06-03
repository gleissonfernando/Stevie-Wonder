const { Events } = require("discord.js");
const { sendAuditLog } = require("../../services/discord/auditLogger");

module.exports = {
  name: Events.GuildRoleCreate,
  async execute(role) {
    await sendAuditLog(role.guild, {
      title: "Cargo criado",
      color: 0x22c55e,
      fields: [
        { name: "Cargo", value: `${role.name} (${role.id})` }
      ]
    });
  }
};
