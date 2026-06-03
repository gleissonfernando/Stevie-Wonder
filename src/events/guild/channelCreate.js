const { Events } = require("discord.js");
const { sendAuditLog } = require("../../services/discord/auditLogger");

module.exports = {
  name: Events.ChannelCreate,
  async execute(channel) {
    await sendAuditLog(channel.guild, {
      title: "Canal criado",
      color: 0x22c55e,
      fields: [
        { name: "Canal", value: `${channel.name} (${channel.id})` },
        { name: "Tipo", value: String(channel.type), inline: true }
      ]
    });
  }
};
