const mongoose = require("mongoose");
const {
  AppearanceConfig,
  AuditLog,
  CommandConfig,
  Guild,
  GuildConfig,
  LeaveConfig,
  LogConfig,
  RoleConfig,
  TwitchAlert,
  VerificationConfig,
  WelcomeConfig
} = require("../../models/dashboard");
const config = require("../../config/config");

const moduleModels = {
  config: GuildConfig,
  twitch: TwitchAlert,
  welcome: WelcomeConfig,
  leave: LeaveConfig,
  logs: LogConfig,
  roles: RoleConfig,
  verification: VerificationConfig,
  commands: CommandConfig,
  appearance: AppearanceConfig
};

const defaultConfigs = {
  config: {
    prefix: config.defaultPrefix,
    language: "pt-BR",
    timezone: "America/Sao_Paulo",
    defaultChannelId: "",
    adminRoles: []
  },
  twitch: {
    enabled: false,
    twitchChannel: "",
    discordChannelId: "",
    mentionRoleId: "",
    message: "{user} entrou ao vivo na Twitch!",
    embedColor: "#8b5cf6",
    bannerUrl: "",
    intervalMinutes: 5,
    lastLiveId: "",
    lastMessageId: ""
  },
  welcome: {
    enabled: false,
    channelId: "",
    message: "Bem-vindo(a), {user}! Voce entrou no {server}. Agora somos {memberCount}.",
    embedEnabled: true,
    embedColor: "#22c55e",
    imageUrl: "",
    autoRoleId: ""
  },
  leave: {
    enabled: false,
    channelId: "",
    message: "{user} saiu do servidor. Agora somos {memberCount}.",
    embedEnabled: true,
    embedColor: "#ef4444",
    imageUrl: ""
  },
  logs: {
    enabled: false,
    channelId: "",
    embedColor: "#3b82f6",
    mentionAdminRole: false,
    adminRoleId: "",
    events: {
      memberJoin: true,
      memberLeave: true,
      messageDelete: true,
      messageUpdate: true,
      bans: true,
      kicks: true,
      roleAdd: true,
      roleRemove: true,
      channelCreate: true,
      channelDelete: true,
      guildUpdate: true,
      panelChanges: true
    }
  },
  roles: {
    enabled: false,
    joinRoleId: "",
    verificationRoleId: "",
    twitchSubRoleId: "",
    vipRoleId: "",
    removableRoleId: "",
    temporaryRoleId: "",
    temporaryMinutes: 60
  },
  verification: {
    enabled: false,
    channelId: "",
    roleId: "",
    panelMessage: "Clique no botao abaixo para liberar seu acesso.",
    title: "Verificacao",
    description: "Confirme que voce leu as regras do servidor.",
    embedColor: "#3b82f6",
    buttonText: "Verificar",
    buttonEmoji: "",
    messageId: ""
  },
  commands: {
    commands: []
  },
  appearance: {
    primaryColor: "#3b82f6",
    secondaryColor: "#8b5cf6",
    logoUrl: "",
    bannerUrl: "",
    backgroundUrl: "",
    panelName: "Ricardinn98 Dashboard"
  }
};

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function requireDatabase() {
  if (!isDatabaseConnected()) {
    throw new Error("MongoDB nao esta conectado. Configure MONGO_URI ou MONGODB_URI.");
  }
}

function toPlain(document) {
  if (!document) return null;
  const plain = typeof document.toObject === "function" ? document.toObject() : document;
  delete plain._id;
  delete plain.__v;
  return plain;
}

function mergeDefault(moduleName, data) {
  return {
    guildId: data?.guildId || "",
    ...structuredClone(defaultConfigs[moduleName] || {}),
    ...(data || {})
  };
}

async function getModuleConfig(moduleName, guildId) {
  const Model = moduleModels[moduleName];
  if (!Model) throw new Error(`Modulo desconhecido: ${moduleName}`);

  if (!isDatabaseConnected()) {
    return mergeDefault(moduleName, { guildId });
  }

  const document = await Model.findOne({ guildId }).lean();
  return mergeDefault(moduleName, document || { guildId });
}

async function saveModuleConfig(moduleName, guildId, payload, actor) {
  const Model = moduleModels[moduleName];
  if (!Model) throw new Error(`Modulo desconhecido: ${moduleName}`);
  requireDatabase();

  const oldValue = await Model.findOne({ guildId }).lean();
  const document = await Model.findOneAndUpdate(
    { guildId },
    { guildId, ...payload, updatedAt: new Date() },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await AuditLog.create({
    guildId,
    userId: actor?.id || "sistema",
    username: actor?.username || "Sistema",
    action: "Configuracao alterada no painel",
    module: moduleName,
    oldValue: oldValue || null,
    newValue: toPlain(document)
  });

  return {
    oldValue: oldValue || null,
    newValue: mergeDefault(moduleName, toPlain(document))
  };
}

async function createAuditLog({ guildId, user, action, module, oldValue = null, newValue = null }) {
  if (!isDatabaseConnected()) return null;

  return AuditLog.create({
    guildId,
    userId: user?.id || "sistema",
    username: user?.username || "Sistema",
    action,
    module,
    oldValue,
    newValue
  });
}

async function syncGuild(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild || !isDatabaseConnected()) return null;

  const owner = await guild.fetchOwner().catch(() => null);
  return Guild.findOneAndUpdate(
    { guildId },
    {
      guildId,
      ownerId: owner?.id || guild.ownerId || "",
      name: guild.name,
      icon: guild.iconURL({ size: 128 }) || "",
      memberCount: guild.memberCount || 0,
      botPresent: true,
      lastSyncAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function getGuildIcon(guild) {
  return guild.iconURL({ size: 128 }) || "";
}

async function getGuildDashboardData(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return null;

  await syncGuild(client, guildId);

  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  const roles = await guild.roles.fetch().catch(() => guild.roles.cache);

  const textChannels = [...(channels?.values?.() || [])]
    .filter((channel) => channel && channel.isTextBased())
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const roleList = [...(roles?.values?.() || [])]
    .filter((role) => role && role.id !== guild.id)
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.hexColor,
      position: role.position
    }))
    .sort((a, b) => b.position - a.position);

  return {
    id: guild.id,
    name: guild.name,
    icon: getGuildIcon(guild),
    ownerId: guild.ownerId,
    memberCount: guild.memberCount || 0,
    channelCount: channels?.size || guild.channels.cache.size,
    roleCount: roles?.size || guild.roles.cache.size,
    channels: textChannels,
    roles: roleList,
    botPresent: true,
    lastSyncAt: new Date().toISOString()
  };
}

function getBotStatus(client, startedAt, websocketClients = 0) {
  const uptimeMs = startedAt ? Date.now() - startedAt.getTime() : client.uptime || 0;
  return {
    online: Boolean(client?.isReady?.()),
    status: client?.isReady?.() ? "Online" : "Offline",
    ping: Math.round(client?.ws?.ping || 0),
    uptimeMs,
    uptime: formatUptime(uptimeMs),
    guildCount: client.guilds.cache.size,
    clientId: client.user?.id || process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || "",
    userCount: client.guilds.cache.reduce((total, guild) => total + (guild.memberCount || 0), 0),
    commandCount: client.commands?.size || 0,
    mongo: isDatabaseConnected() ? "Online" : "Offline",
    api: "Online",
    websocket: websocketClients > 0 ? "Online" : "Aguardando cliente",
    websocketClients,
    version: process.env.npm_package_version || "1.0.0"
  };
}

function formatUptime(ms) {
  const totalSeconds = Math.floor((ms || 0) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

module.exports = {
  createAuditLog,
  defaultConfigs,
  getBotStatus,
  getGuildDashboardData,
  getModuleConfig,
  isDatabaseConnected,
  moduleModels,
  saveModuleConfig,
  syncGuild
};
