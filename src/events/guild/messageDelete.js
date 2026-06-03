const { Events } = require("discord.js");
const { sendAuditLog, trim } = require("../../services/discord/auditLogger");
const { handleRulesPanelDelete } = require("../../services/discord/rulesPanel");

module.exports = {
  name: Events.MessageDelete,
  async execute(message, client) {
    if (await handleRulesPanelDelete(message, client)) return;
    if (!message.guild || message.author?.bot) return;

    await sendAuditLog(message.guild, {
      title: "Mensagem apagada",
      color: 0xef4444,
      fields: [
        { name: "Canal", value: `<#${message.channelId}>`, inline: true },
        { name: "Autor", value: message.author ? `${message.author.tag} (${message.author.id})` : "Desconhecido", inline: true },
        { name: "Conteudo", value: trim(message.content || "Sem conteudo.") }
      ]
    });
  }
};
