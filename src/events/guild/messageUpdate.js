const { Events } = require("discord.js");
const { sendAuditLog, trim } = require("../../services/discord/auditLogger");

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;

    await sendAuditLog(newMessage.guild, {
      title: "Mensagem editada",
      color: 0xeab308,
      fields: [
        { name: "Canal", value: `<#${newMessage.channelId}>`, inline: true },
        { name: "Autor", value: `${newMessage.author.tag} (${newMessage.author.id})`, inline: true },
        { name: "Antes", value: trim(oldMessage.content || "Sem conteudo.") },
        { name: "Depois", value: trim(newMessage.content || "Sem conteudo.") }
      ]
    });
  }
};
