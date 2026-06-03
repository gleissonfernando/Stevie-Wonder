const { sendAuditLog } = require("../../services/discord/auditLogger");

module.exports = {
  name: "channelDelete",
  async execute(channel) {
    // Canais apagados manualmente nao sao recriados automaticamente.
    await sendAuditLog(channel.guild, {
      title: "Canal removido",
      color: 0xef4444,
      fields: [
        { name: "Canal", value: `${channel.name} (${channel.id})` },
        { name: "Tipo", value: String(channel.type), inline: true }
      ]
    });
  }
};
