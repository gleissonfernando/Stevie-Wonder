const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const auditConfig = require("../../config/auditLogs");
const { getModuleConfig, isDatabaseConnected } = require("../dashboard/configStore");
const { colorToInt } = require("../dashboard/botBridge");
const logger = require("../../utils/logger");

const actionEventMap = {
  member_join: "memberJoin",
  member_leave: "memberLeave",
  message_delete: "messageDelete",
  message_update: "messageUpdate",
  guild_ban_add: "bans",
  guild_ban_remove: "bans",
  role_create: "roleAdd",
  role_delete: "roleRemove",
  channel_create: "channelCreate",
  channel_delete: "channelDelete",
  guild_update: "guildUpdate",
  panel_change: "panelChanges"
};

async function resolveAuditChannel(guild, dashboardLogConfig) {
  const dashboardChannelId = dashboardLogConfig?.enabled ? dashboardLogConfig.channelId : "";
  const primaryChannelId = dashboardChannelId || auditConfig.channelId;
  const channelById = primaryChannelId
    ? await guild.channels.fetch(primaryChannelId).catch(() => null)
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
  const dashboardLogConfig = isDatabaseConnected()
    ? await getModuleConfig("logs", guild.id).catch(() => null)
    : null;
  const eventKey = actionEventMap[payload.action];

  if (dashboardLogConfig?.enabled && eventKey && dashboardLogConfig.events?.[eventKey] === false) {
    return;
  }

  const channel = await resolveAuditChannel(guild, dashboardLogConfig);

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
    .setColor(dashboardLogConfig?.enabled ? colorToInt(dashboardLogConfig.embedColor) : payload.color || 0x5865f2)
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

  const content = dashboardLogConfig?.enabled && dashboardLogConfig.mentionAdminRole && dashboardLogConfig.adminRoleId
    ? `<@&${dashboardLogConfig.adminRoleId}>`
    : "";

  await channel.send({
    content,
    embeds: [embed],
    allowedMentions: { roles: dashboardLogConfig?.adminRoleId ? [dashboardLogConfig.adminRoleId] : [] }
  }).catch((error) => {
    logger.warn(`Nao foi possivel enviar auditoria: ${error.message}`);
  });
}

module.exports = {
  sendAuditLog,
  trim
};
