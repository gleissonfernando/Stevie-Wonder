const mongoose = require("mongoose");

const { Schema } = mongoose;

function safeModel(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

const userSchema = new Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    globalName: { type: String, default: "" },
    avatar: { type: String, default: "" },
    email: { type: String, default: "" },
    guilds: { type: [Schema.Types.Mixed], default: [] },
    lastLoginAt: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: "users" }
);

const guildSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, default: "" },
    name: { type: String, required: true },
    icon: { type: String, default: "" },
    memberCount: { type: Number, default: 0 },
    botPresent: { type: Boolean, default: true },
    lastSyncAt: { type: Date, default: Date.now }
  },
  { timestamps: true, collection: "guilds" }
);

const guildConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, default: "" },
    prefix: { type: String, default: "!" },
    language: { type: String, default: "pt-BR" },
    timezone: { type: String, default: "America/Sao_Paulo" },
    defaultChannelId: { type: String, default: "" },
    adminRoles: { type: [String], default: [] }
  },
  { timestamps: true, collection: "guild_configs" }
);

const twitchAlertSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    twitchChannel: { type: String, default: "" },
    discordChannelId: { type: String, default: "" },
    mentionRoleId: { type: String, default: "" },
    message: { type: String, default: "{user} entrou ao vivo na Twitch!" },
    embedColor: { type: String, default: "#8b5cf6" },
    bannerUrl: { type: String, default: "" },
    intervalMinutes: { type: Number, default: 5 },
    lastLiveId: { type: String, default: "" },
    lastMessageId: { type: String, default: "" }
  },
  { timestamps: true, collection: "twitch_alerts" }
);

const welcomeConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: "" },
    message: { type: String, default: "Bem-vindo(a), {user}! Voce entrou no {server}. Agora somos {memberCount}." },
    embedEnabled: { type: Boolean, default: true },
    embedColor: { type: String, default: "#22c55e" },
    imageUrl: { type: String, default: "" },
    autoRoleId: { type: String, default: "" }
  },
  { timestamps: true, collection: "welcome_configs" }
);

const leaveConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: "" },
    message: { type: String, default: "{user} saiu do servidor. Agora somos {memberCount}." },
    embedEnabled: { type: Boolean, default: true },
    embedColor: { type: String, default: "#ef4444" },
    imageUrl: { type: String, default: "" }
  },
  { timestamps: true, collection: "leave_configs" }
);

const logConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: "" },
    embedColor: { type: String, default: "#3b82f6" },
    mentionAdminRole: { type: Boolean, default: false },
    adminRoleId: { type: String, default: "" },
    events: {
      memberJoin: { type: Boolean, default: true },
      memberLeave: { type: Boolean, default: true },
      messageDelete: { type: Boolean, default: true },
      messageUpdate: { type: Boolean, default: true },
      bans: { type: Boolean, default: true },
      kicks: { type: Boolean, default: true },
      roleAdd: { type: Boolean, default: true },
      roleRemove: { type: Boolean, default: true },
      channelCreate: { type: Boolean, default: true },
      channelDelete: { type: Boolean, default: true },
      guildUpdate: { type: Boolean, default: true },
      panelChanges: { type: Boolean, default: true }
    }
  },
  { timestamps: true, collection: "log_configs" }
);

const roleConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    joinRoleId: { type: String, default: "" },
    verificationRoleId: { type: String, default: "" },
    twitchSubRoleId: { type: String, default: "" },
    vipRoleId: { type: String, default: "" },
    removableRoleId: { type: String, default: "" },
    temporaryRoleId: { type: String, default: "" },
    temporaryMinutes: { type: Number, default: 60 }
  },
  { timestamps: true, collection: "role_configs" }
);

const verificationConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    channelId: { type: String, default: "" },
    roleId: { type: String, default: "" },
    panelMessage: { type: String, default: "Clique no botao abaixo para liberar seu acesso." },
    title: { type: String, default: "Verificacao" },
    description: { type: String, default: "Confirme que voce leu as regras do servidor." },
    embedColor: { type: String, default: "#3b82f6" },
    buttonText: { type: String, default: "Verificar" },
    buttonEmoji: { type: String, default: "" },
    messageId: { type: String, default: "" }
  },
  { timestamps: true, collection: "verification_configs" }
);

const commandConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    commands: {
      type: [
        {
          name: String,
          description: String,
          category: String,
          enabled: { type: Boolean, default: true },
          requiredPermission: { type: String, default: "" },
          allowedChannelId: { type: String, default: "" },
          allowedRoleId: { type: String, default: "" },
          hiddenWhenDenied: { type: Boolean, default: false }
        }
      ],
      default: []
    }
  },
  { timestamps: true, collection: "command_configs" }
);

const appearanceConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    primaryColor: { type: String, default: "#3b82f6" },
    secondaryColor: { type: String, default: "#8b5cf6" },
    logoUrl: { type: String, default: "" },
    bannerUrl: { type: String, default: "" },
    backgroundUrl: { type: String, default: "" },
    panelName: { type: String, default: "Ricardinn98 Dashboard" }
  },
  { timestamps: true, collection: "appearance_configs" }
);

const auditLogSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    action: { type: String, required: true },
    module: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "audit_logs" }
);

const sessionSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    tokenId: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null }
  },
  { timestamps: true, collection: "sessions" }
);

module.exports = {
  User: safeModel("DashboardUser", userSchema),
  Guild: safeModel("DashboardGuild", guildSchema),
  GuildConfig: safeModel("DashboardGuildConfig", guildConfigSchema),
  TwitchAlert: safeModel("DashboardTwitchAlert", twitchAlertSchema),
  WelcomeConfig: safeModel("DashboardWelcomeConfig", welcomeConfigSchema),
  LeaveConfig: safeModel("DashboardLeaveConfig", leaveConfigSchema),
  LogConfig: safeModel("DashboardLogConfig", logConfigSchema),
  RoleConfig: safeModel("DashboardRoleConfig", roleConfigSchema),
  VerificationConfig: safeModel("DashboardVerificationConfig", verificationConfigSchema),
  CommandConfig: safeModel("DashboardCommandConfig", commandConfigSchema),
  AppearanceConfig: safeModel("DashboardAppearanceConfig", appearanceConfigSchema),
  AuditLog: safeModel("DashboardAuditLog", auditLogSchema),
  Session: safeModel("DashboardSession", sessionSchema)
};
