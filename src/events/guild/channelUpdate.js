const { Events } = require("discord.js");
const { sendAuditLog } = require("../../services/discord/auditLogger");

module.exports = {
  name: Events.ChannelUpdate,
  async execute(oldChannel, newChannel) {
    if (oldChannel.name === newChannel.name && oldChannel.parentId === newChannel.parentId) return;

    await sendAuditLog(newChannel.guild, {
      title: "Canal atualizado",
      color: 0xeab308,
      fields: [
        { name: "Canal", value: `${newChannel.name} (${newChannel.id})` },
        { name: "Nome anterior", value: oldChannel.name || "Sem nome", inline: true },
        { name: "Nome novo", value: newChannel.name || "Sem nome", inline: true }
      ]
    });
  }
};
