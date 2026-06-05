const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { LinkedAccount, TwitchSubConfig, TwitchSubLog } = require("../../models/dashboard");
const { colorToInt, fetchTextChannel } = require("../dashboard/botBridge");
const { EventQueue } = require("./eventQueue");
const logger = require("../../utils/logger");

const twitchSubQueue = new EventQueue({ concurrency: 4 });

async function addSubRole(client, guildId, discordUserId, roleId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, error: "Bot nao esta no servidor.", status: "guild_not_found" };

  const member = await guild.members.fetch(discordUserId).catch(() => null);
  if (!member) return { ok: false, error: "Membro nao esta no servidor.", status: "member_not_found" };

  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) return { ok: false, error: "Cargo configurado nao existe.", status: "role_not_found" };

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    return { ok: false, error: "Bot nao tem permissao Gerenciar Cargos.", status: "missing_manage_roles" };
  }

  if (role.position >= botMember.roles.highest.position) {
    return { ok: false, error: "Cargo do bot esta abaixo do cargo de sub.", status: "role_hierarchy" };
  }

  if (!member.roles.cache.has(role.id)) {
    await member.roles.add(role, "Sub Twitch detectada pelo dashboard");
  }

  return { ok: true, guildName: guild.name, roleId: role.id, status: "role_added" };
}

async function removeSubRole(client, guildId, discordUserId, roleId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return { ok: false, error: "Bot nao esta no servidor.", status: "guild_not_found" };

  const member = await guild.members.fetch(discordUserId).catch(() => null);
  if (!member) return { ok: false, error: "Membro nao esta no servidor.", status: "member_not_found" };

  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role) return { ok: false, error: "Cargo configurado nao existe.", status: "role_not_found" };

  const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
    return { ok: false, error: "Bot nao tem permissao Gerenciar Cargos.", status: "missing_manage_roles" };
  }

  if (role.position >= botMember.roles.highest.position) {
    return { ok: false, error: "Cargo do bot esta abaixo do cargo de sub.", status: "role_hierarchy" };
  }

  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role, "Sub Twitch encerrada pelo dashboard");
  }

  return { ok: true, guildName: guild.name, roleId: role.id, status: "role_removed" };
}

function buildSubEmbed({ action, config, discordUserId, error, roleId, status, twitchUsername }) {
  const isEnd = action === "subscription_end";
  const isError = Boolean(error);

  const embed = new EmbedBuilder()
    .setColor(isError ? 0xff3b3b : colorToInt("#b91c1c", 0xb91c1c))
    .setTimestamp(new Date())
    .setFooter({ text: "Sistema de Cargo Sub Twitch" });

  if (isError) {
    embed
      .setTitle("Erro ao entregar cargo de Sub")
      .setDescription("O sistema detectou uma sub, mas nao conseguiu entregar o cargo.")
      .addFields(
        { name: "Twitch", value: twitchUsername || "Desconhecido", inline: true },
        { name: "Motivo", value: error || "Erro desconhecido.", inline: false },
        { name: "Possivel solucao", value: "Vincular conta ou verificar permissoes do bot.", inline: false }
      );
    return embed;
  }

  if (isEnd) {
    embed
      .setTitle("Sub Twitch Encerrada")
      .setDescription("A sub do usuario acabou e o cargo foi removido.")
      .addFields(
        { name: "Twitch", value: twitchUsername || "Desconhecido", inline: true },
        { name: "Discord", value: discordUserId ? `<@${discordUserId}>` : "Nao vinculado", inline: true },
        { name: "Cargo removido", value: roleId ? `<@&${roleId}>` : "Nao configurado", inline: true }
      );
    return embed;
  }

  embed
    .setTitle("Nova Sub Twitch Detectada")
    .setDescription(formatSubMessage(config.customMessage || "Um usuario deu sub na live e recebeu o cargo no Discord.", {
      discordUserId,
      guildName: config.guildName || config.guildId,
      roleId,
      twitchUsername
    }))
    .addFields(
      { name: "Twitch", value: twitchUsername || "Desconhecido", inline: true },
      { name: "Discord", value: discordUserId ? `<@${discordUserId}>` : "Nao vinculado", inline: true },
      { name: "Cargo entregue", value: roleId ? `<@&${roleId}>` : "Nao configurado", inline: true },
      { name: "Servidor", value: config.guildName || config.guildId, inline: true },
      { name: "Status", value: status || "Cargo entregue com sucesso", inline: false }
    );

  return embed;
}

async function sendSubLogEmbed(client, config, payload) {
  if (!config.logChannelId) return null;

  const channel = await fetchTextChannel(client, config.guildId, config.logChannelId);
  if (!channel) return null;

  const embed = buildSubEmbed({ config, ...payload });
  return channel.send({ embeds: [embed] }).catch((error) => {
    logger.warn(`Nao foi possivel enviar log de Sub Twitch: ${error.message}`);
    return null;
  });
}

async function saveTwitchSubLog(payload) {
  return TwitchSubLog.create({
    guildId: payload.guildId,
    twitchUserId: payload.twitchUserId || "",
    twitchUsername: payload.twitchUsername || "",
    discordUserId: payload.discordUserId || "",
    action: payload.action,
    roleId: payload.roleId || "",
    status: payload.status,
    error: payload.error || ""
  });
}

function formatSubMessage(template, values) {
  return String(template || "").replace(/\{(twitchUsername|discordUserId|roleId|guildName)\}/g, (_, key) => values[key] || "");
}

function getEventUser(event) {
  return {
    twitchUserId: event.user_id || event.user?.id || "",
    twitchUsername: event.user_name || event.user_login || event.user?.login || "desconhecido",
    broadcasterId: event.broadcaster_user_id || "",
    broadcasterName: event.broadcaster_user_name || event.broadcaster_user_login || ""
  };
}

function mapEventTypeToAction(type) {
  if (type === "channel.subscription.end") return "subscription_end";
  if (type === "channel.subscription.message") return "subscription_message";
  return "subscription_add";
}

async function processConfigForSubEvent(client, io, config, eventType, event) {
  const action = mapEventTypeToAction(eventType);
  const { twitchUserId, twitchUsername } = getEventUser(event);

  if (!config.enabled) return null;
  if (!config.subRoleId) throw new Error("Cargo de sub nao configurado.");

  const linked = await LinkedAccount.findOne({ twitchUserId }).lean();

  if (!linked) {
    const error = "Usuario deu sub, mas ainda nao vinculou Twitch + Discord.";
    await saveTwitchSubLog({
      guildId: config.guildId,
      twitchUserId,
      twitchUsername,
      action,
      roleId: config.subRoleId,
      status: "not_linked",
      error
    });
    await sendSubLogEmbed(client, config, { action, error, roleId: config.subRoleId, twitchUsername });
    return { ok: false, error, status: "not_linked" };
  }

  const result = action === "subscription_end"
    ? await removeSubRole(client, config.guildId, linked.discordUserId, config.subRoleId)
    : await addSubRole(client, config.guildId, linked.discordUserId, config.subRoleId);

  await saveTwitchSubLog({
    guildId: config.guildId,
    twitchUserId,
    twitchUsername,
    discordUserId: linked.discordUserId,
    action,
    roleId: config.subRoleId,
    status: result.status,
    error: result.error || ""
  });

  await TwitchSubConfig.updateOne(
    { guildId: config.guildId },
    {
      lastSubAt: new Date(),
      lastSubTwitchUsername: twitchUsername,
      updatedAt: new Date()
    }
  );

  await sendSubLogEmbed(client, config, {
    action,
    discordUserId: linked.discordUserId,
    error: result.error,
    roleId: config.subRoleId,
    status: result.ok ? "Cargo entregue com sucesso" : result.status,
    twitchUsername
  });

  io.to(`guild:${config.guildId}`).emit("twitch:subEvent", {
    guildId: config.guildId,
    twitchUserId,
    twitchUsername,
    discordUserId: linked.discordUserId,
    action,
    status: result.status,
    ok: result.ok,
    error: result.error || "",
    createdAt: new Date().toISOString()
  });

  return result;
}

async function handleTwitchSubEvent(client, io, eventType, event) {
  const { broadcasterId } = getEventUser(event);
  if (!broadcasterId) return [];

  const configs = await TwitchSubConfig.find({
    twitchBroadcasterId: broadcasterId,
    enabled: true
  }).lean();

  const tasks = configs.map((config) => twitchSubQueue.add(() => processConfigForSubEvent(client, io, config, eventType, event)));
  return Promise.allSettled(tasks);
}

async function testTwitchSubSystem(client, io, { guildId, user }) {
  const config = await TwitchSubConfig.findOne({ guildId }).lean();
  if (!config) throw new Error("Configure o sistema de Cargo Sub Twitch antes de testar.");
  if (!config.enabled) throw new Error("Ative o sistema antes de testar.");
  if (!config.subRoleId) throw new Error("Escolha o cargo de sub antes de testar.");

  const linked = await LinkedAccount.findOne({ discordUserId: user.id }).lean();
  if (!linked) {
    const error = "Seu Discord ainda nao esta vinculado a uma conta Twitch.";
    await saveTwitchSubLog({
      guildId,
      twitchUserId: "",
      twitchUsername: "",
      discordUserId: user.id,
      action: "test",
      roleId: config.subRoleId,
      status: "not_linked",
      error
    });
    await sendSubLogEmbed(client, config, { action: "test", discordUserId: user.id, error, roleId: config.subRoleId, twitchUsername: "Teste" });
    throw new Error(error);
  }

  const result = await addSubRole(client, guildId, user.id, config.subRoleId);

  await saveTwitchSubLog({
    guildId,
    twitchUserId: linked.twitchUserId,
    twitchUsername: linked.twitchUsername,
    discordUserId: user.id,
    action: "test",
    roleId: config.subRoleId,
    status: result.status,
    error: result.error || ""
  });

  await sendSubLogEmbed(client, config, {
    action: "subscription_add",
    discordUserId: user.id,
    error: result.error,
    roleId: config.subRoleId,
    status: result.ok ? "Cargo entregue com sucesso" : result.status,
    twitchUsername: linked.twitchUsername
  });

  io.to(`guild:${guildId}`).emit("twitch:subTest", {
    guildId,
    ok: result.ok,
    status: result.status,
    error: result.error || "",
    twitchUsername: linked.twitchUsername,
    discordUserId: user.id,
    createdAt: new Date().toISOString()
  });

  if (!result.ok) throw new Error(result.error);
  return result;
}

module.exports = {
  addSubRole,
  handleTwitchSubEvent,
  removeSubRole,
  sendSubLogEmbed,
  testTwitchSubSystem,
  twitchSubQueue
};
