const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");
const DashboardConfig = require("../../models/DashboardConfig");

async function getGuild(client, guildId) {
  const guild = await client.guilds.fetch(guildId);
  if (!guild) throw new Error("Servidor nao encontrado pelo bot.");
  return guild;
}

async function getTextChannel(guild, channelId) {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
    throw new Error("Canal de texto invalido.");
  }

  const permissions = channel.permissionsFor(guild.members.me);
  if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    throw new Error("Bot sem permissao para enviar mensagens no canal.");
  }

  return channel;
}

async function logToConfiguredChannel(client, guildId, message) {
  const config = await DashboardConfig.findOne({ guildId });
  if (!config?.logChannelId) return;

  try {
    const guild = await getGuild(client, guildId);
    const channel = await getTextChannel(guild, config.logChannelId);
    await channel.send(message);
  } catch {
    // Logging must never break the dashboard action execution path.
  }
}

async function setLogChannel(client, { guildId, payload }) {
  const guild = await getGuild(client, guildId);
  await getTextChannel(guild, payload.channelId);
  await DashboardConfig.updateOne({ guildId }, { logChannelId: payload.channelId }, { upsert: true });
  return `Canal de logs atualizado para <#${payload.channelId}>.`;
}

async function sendAnnouncement(client, { guildId, payload }) {
  const guild = await getGuild(client, guildId);
  const channel = await getTextChannel(guild, payload.channelId);
  await channel.send(payload.message);
  return "Aviso enviado com sucesso.";
}

async function createPanel(client, { guildId, payload }) {
  const guild = await getGuild(client, guildId);
  const channel = await getTextChannel(guild, payload.channelId);
  const embed = new EmbedBuilder().setTitle(payload.title).setDescription(payload.description).setColor(0x2b313a);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("dashboard:panel").setLabel("Abrir painel").setStyle(ButtonStyle.Secondary)
  );
  const message = await channel.send({ embeds: [embed], components: [row] });
  await DashboardConfig.updateOne(
    { guildId },
    { $set: { [`panels.${message.id}`]: { ...payload, messageId: message.id } } },
    { upsert: true }
  );
  return `Painel criado com sucesso: ${message.id}.`;
}

async function updatePanel(client, { guildId, payload }) {
  const guild = await getGuild(client, guildId);
  const channel = await getTextChannel(guild, payload.channelId);
  const message = await channel.messages.fetch(payload.messageId);
  const embed = new EmbedBuilder().setTitle(payload.title).setDescription(payload.description).setColor(0x2b313a);
  await message.edit({ embeds: [embed] });
  return "Painel atualizado com sucesso.";
}

async function setWelcomeMessage(_client, { guildId, payload }) {
  await DashboardConfig.updateOne({ guildId }, { welcomeMessage: payload.message }, { upsert: true });
  return "Mensagem de boas-vindas atualizada.";
}

async function setAutoRole(client, { guildId, payload }) {
  const guild = await getGuild(client, guildId);
  const role = await guild.roles.fetch(payload.roleId);
  if (!role) throw new Error("Cargo nao encontrado.");
  await DashboardConfig.updateOne({ guildId }, { autoRoleId: payload.roleId }, { upsert: true });
  return `Cargo automatico atualizado para ${role.name}.`;
}

async function toggleSystem(_client, { guildId, payload }) {
  await DashboardConfig.updateOne(
    { guildId },
    { $set: { [`systems.${payload.system}`]: payload.enabled } },
    { upsert: true }
  );
  return `${payload.system} ${payload.enabled ? "ativado" : "desativado"}.`;
}

async function updateConfig(_client, { guildId, payload }) {
  await DashboardConfig.updateOne(
    { guildId },
    { $set: { [`settings.${payload.key}`]: payload.value } },
    { upsert: true }
  );
  return "Configuracao salva no bot.";
}

const handlers = {
  "site:updateConfig": updateConfig,
  "site:sendAnnouncement": sendAnnouncement,
  "site:createPanel": createPanel,
  "site:updatePanel": updatePanel,
  "site:setLogChannel": setLogChannel,
  "site:setWelcomeMessage": setWelcomeMessage,
  "site:setAutoRole": setAutoRole,
  "site:toggleSystem": toggleSystem
};

module.exports = {
  handlers,
  logToConfiguredChannel
};
