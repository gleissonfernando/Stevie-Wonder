const { Events } = require("discord.js");
const { sendAuditLog } = require("../../services/discord/auditLogger");

module.exports = {
  name: Events.GuildRoleUpdate,
  async execute(oldRole, newRole) {
    if (
      oldRole.name === newRole.name &&
      oldRole.color === newRole.color &&
      oldRole.permissions.bitfield === newRole.permissions.bitfield
    ) {
      return;
    }

    await sendAuditLog(newRole.guild, {
      title: "Cargo atualizado",
      color: 0xeab308,
      fields: [
        { name: "Cargo", value: `${newRole.name} (${newRole.id})` },
        { name: "Nome anterior", value: oldRole.name, inline: true },
        { name: "Nome novo", value: newRole.name, inline: true }
      ]
    });
  }
};
