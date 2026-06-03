const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const auditConfig = require("../../config/auditLogs");
const logger = require("../../utils/logger");

async function resolveAuditChannel(guild) {
  const channelById = auditConfig.channelId
    ? await guild.channels.fetch(auditConfig.channelId).catch(() => null)
    : null;

  if (channelById?.isTextBased()) return channelById;

  const channels = await guild.channels.fetch().catch(() => null);
  return channels?.find((channel) => channel?.name === auditConfig.channelName && channel.isTextBased()) || null;
}

function trim(value, maxLength = 900) {
  if (!value) return "Sem conteudo.";
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

async function sendAuditLog(guild, payload) {
  const channel = await resolveAuditChannel(guild);

  if (!channel) {
    logger.warn(`Canal de auditoria nao encontrado: ${auditConfig.channelId || auditConfig.channelName}`);
    return;
  }

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  const permissions = botMember ? channel.permissionsFor(botMember) : null;

  if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    logger.warn(`Sem permissao para enviar auditoria no canal ${channel.name}.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(payload.color || 0x5865f2)
    .setTitle(payload.title)
    .setDescription(payload.description || null)
    .setTimestamp(new Date())
    .setFooter({ text: "Sistema de auditoria" });

  for (const field of payload.fields || []) {
    embed.addFields({
      name: field.name,
      value: trim(String(field.value), 1024),
      inline: Boolean(field.inline)
    });
  }

  await channel.send({ embeds: [embed] }).catch((error) => {
    logger.warn(`Nao foi possivel enviar auditoria: ${error.message}`);
  });
}

module.exports = {
  sendAuditLog,
  trim
};
