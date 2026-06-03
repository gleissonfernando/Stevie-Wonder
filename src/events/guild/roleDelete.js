const { sendAuditLog } = require("../../services/discord/auditLogger");

module.exports = {
  name: "roleDelete",
  async execute(role) {
    // Cargos apagados manualmente nao sao recriados automaticamente.
    await sendAuditLog(role.guild, {
      title: "Cargo removido",
      color: 0xef4444,
      fields: [
        { name: "Cargo", value: `${role.name} (${role.id})` }
      ]
    });
  }
};
