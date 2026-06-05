const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");
const { getBotStatus, getModuleConfig } = require("./configStore");
const logger = require("../../utils/logger");

function colorToInt(color, fallback = 0x3b82f6) {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return fallback;
  return Number.parseInt(color.slice(1), 16);
}

function replaceVars(template, values) {
  return String(template || "").replace(/\{(user|server|memberCount|userId)\}/g, (_, key) => values[key] || "");
}

async function fetchTextChannel(client, guildId, channelId) {
  if (!channelId) return null;
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;

  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return null;

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  const permissions = botMember ? channel.permissionsFor(botMember) : null;

  if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    logger.warn(`Sem permissao para enviar mensagens no canal ${channel.name}.`);
    return null;
  }

  return channel;
}

function createBotBridge(client, io) {
  const startedAt = new Date();
  const runtimeConfigs = new Map();

  function key(moduleName, guildId) {
    return `${guildId}:${moduleName}`;
  }

  function emitStatus() {
    io.emit("bot:status", getBotStatus(client, startedAt, io.engine.clientsCount));
    io.emit("bot:ping", { ping: Math.round(client.ws.ping || 0), at: new Date().toISOString() });
  }

  function applyConfig(moduleName, guildId, config, actor) {
    runtimeConfigs.set(key(moduleName, guildId), config);

    const payload = {
      guildId,
      module: moduleName,
      config,
      actor: actor ? { id: actor.id, username: actor.username } : null,
      updatedAt: new Date().toISOString()
    };

    io.to(`guild:${guildId}`).emit("dashboard:updateConfig", payload);
    io.to(`guild:${guildId}`).emit("bot:configUpdated", payload);

    return payload;
  }

  async function getRuntimeConfig(moduleName, guildId) {
    const cached = runtimeConfigs.get(key(moduleName, guildId));
    if (cached) return cached;

    const config = await getModuleConfig(moduleName, guildId);
    runtimeConfigs.set(key(moduleName, guildId), config);
    return config;
  }

  async function sendNotice(guildId, notice, actor) {
    const channel = await fetchTextChannel(client, guildId, notice.channelId);
    if (!channel) {
      throw new Error("Canal do aviso nao encontrado ou sem permissao.");
    }

    const embed = new EmbedBuilder()
      .setColor(colorToInt(notice.embedColor))
      .setTitle(notice.title || "Aviso")
      .setDescription(notice.description)
      .setTimestamp(new Date())
      .setFooter({ text: "Ricardinn98 Dashboard" });

    if (notice.imageUrl) embed.setImage(notice.imageUrl);

    const components = [];
    if (notice.buttonLabel && notice.buttonUrl) {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(notice.buttonLabel)
            .setStyle(ButtonStyle.Link)
            .setURL(notice.buttonUrl)
        )
      );
    }

    const content = notice.mentionRoleId ? `<@&${notice.mentionRoleId}>` : "";
    const message = await channel.send({
      content,
      embeds: [embed],
      components,
      allowedMentions: { roles: notice.mentionRoleId ? [notice.mentionRoleId] : [] }
    });

    io.to(`guild:${guildId}`).emit("dashboard:sendNotice", {
      guildId,
      messageId: message.id,
      channelId: channel.id,
      actor,
      sentAt: new Date().toISOString()
    });

    return message;
  }

  async function sendTestAlert(guildId, actor) {
    const config = await getRuntimeConfig("twitch", guildId);
    const channel = await fetchTextChannel(client, guildId, config.discordChannelId);

    if (!channel) {
      throw new Error("Canal de alerta nao encontrado ou sem permissao.");
    }

    const twitchName = config.twitchChannel || "canal_twitch";
    const embed = new EmbedBuilder()
      .setColor(colorToInt(config.embedColor, 0x8b5cf6))
      .setTitle(`${twitchName} esta ao vivo!`)
      .setDescription(config.message || "{user} entrou ao vivo na Twitch!")
      .setURL(`https://twitch.tv/${twitchName}`)
      .setTimestamp(new Date())
      .setFooter({ text: "Teste de alerta pelo dashboard" });

    if (config.bannerUrl) embed.setImage(config.bannerUrl);

    const message = await channel.send({
      content: config.mentionRoleId ? `<@&${config.mentionRoleId}>` : "",
      embeds: [embed],
      allowedMentions: { roles: config.mentionRoleId ? [config.mentionRoleId] : [] }
    });

    io.to(`guild:${guildId}`).emit("dashboard:testAlert", {
      guildId,
      channelId: channel.id,
      messageId: message.id,
      actor,
      sentAt: new Date().toISOString()
    });

    return message;
  }

  async function publishVerificationPanel(guildId) {
    const config = await getRuntimeConfig("verification", guildId);
    if (!config.enabled || !config.channelId || !config.roleId) return null;

    const channel = await fetchTextChannel(client, guildId, config.channelId);
    if (!channel) {
      throw new Error("Canal de verificacao nao encontrado ou sem permissao.");
    }

    const embed = new EmbedBuilder()
      .setColor(colorToInt(config.embedColor))
      .setTitle(config.title || "Verificacao")
      .setDescription(config.description || config.panelMessage)
      .setTimestamp(new Date());

    const button = new ButtonBuilder()
      .setCustomId(`dashboard_verify:${guildId}:${config.roleId}`)
      .setStyle(ButtonStyle.Success)
      .setLabel(config.buttonText || "Verificar");

    if (config.buttonEmoji) button.setEmoji(config.buttonEmoji);

    const payload = {
      content: config.panelMessage || "",
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(button)]
    };

    let message = null;
    if (config.messageId) {
      message = await channel.messages.fetch(config.messageId).catch(() => null);
    }

    if (message) {
      await message.edit(payload);
    } else {
      message = await channel.send(payload);
    }

    io.to(`guild:${guildId}`).emit("dashboard:updateVerification", {
      guildId,
      channelId: channel.id,
      messageId: message.id,
      updatedAt: new Date().toISOString()
    });

    return message;
  }

  async function sendMemberMessage(member, moduleName) {
    const guildId = member.guild.id;
    const config = await getRuntimeConfig(moduleName, guildId);
    if (!config.enabled || !config.channelId) return false;

    const channel = await fetchTextChannel(client, guildId, config.channelId);
    if (!channel) return false;

    const message = replaceVars(config.message, {
      user: `<@${member.id}>`,
      userId: member.id,
      server: member.guild.name,
      memberCount: String(member.guild.memberCount || 0)
    });

    if (config.embedEnabled) {
      const embed = new EmbedBuilder()
        .setColor(colorToInt(config.embedColor))
        .setDescription(message)
        .setTimestamp(new Date());
      if (config.imageUrl) embed.setImage(config.imageUrl);
      await channel.send({ embeds: [embed], allowedMentions: { users: [member.id] } });
    } else {
      await channel.send({ content: message, allowedMentions: { users: [member.id] } });
    }

    return true;
  }

  async function assignConfiguredJoinRole(member) {
    const welcome = await getRuntimeConfig("welcome", member.guild.id);
    const roles = await getRuntimeConfig("roles", member.guild.id);
    const roleId = welcome.autoRoleId || roles.joinRoleId;

    if (!roleId) return false;

    const botMember = member.guild.members.me || await member.guild.members.fetchMe().catch(() => null);
    if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) return false;

    const role = await member.guild.roles.fetch(roleId).catch(() => null);
    if (!role || role.position >= botMember.roles.highest.position) return false;

    await member.roles.add(role, "Cargo automatico configurado pelo dashboard");
    return true;
  }

  function start() {
    emitStatus();
    setInterval(emitStatus, 10000).unref?.();
  }

  return {
    applyConfig,
    assignConfiguredJoinRole,
    emitStatus,
    getRuntimeConfig,
    publishVerificationPanel,
    replaceVars,
    sendMemberMessage,
    sendNotice,
    sendTestAlert,
    start,
    startedAt
  };
}

module.exports = {
  colorToInt,
  createBotBridge,
  fetchTextChannel,
  replaceVars
};
