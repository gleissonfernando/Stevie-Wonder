import mongoose, { Schema } from "mongoose";

const dashboardConfigSchema = new Schema(
  {
    guildId: { type: String, required: true },
    logChannelId: { type: String },
    welcomeMessage: { type: String },
    autoRoleId: { type: String },
    systems: { type: Map, of: Boolean, default: {} },
    panels: { type: Map, of: Schema.Types.Mixed, default: {} },
    settings: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: String }
  },
  { timestamps: true }
);

dashboardConfigSchema.index({ guildId: 1 }, { unique: true });

const dashboardActionLogSchema = new Schema(
  {
    actionId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String },
    action: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed },
    status: { type: String, enum: ["queued", "success", "error"], default: "queued", index: true },
    message: { type: String },
    executedAt: { type: Date }
  },
  { timestamps: true }
);

export const DashboardConfig =
  mongoose.models.DashboardConfig || mongoose.model("DashboardConfig", dashboardConfigSchema);

export const DashboardActionLog =
  mongoose.models.DashboardActionLog || mongoose.model("DashboardActionLog", dashboardActionLogSchema);

const dashboardGuildSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    icon: { type: String },
    memberCount: { type: Number, default: 0 },
    onlineCount: { type: Number, default: 0 },
    botCount: { type: Number, default: 0 },
    newMemberCount: { type: Number, default: 0 },
    leaveCount: { type: Number, default: 0 },
    botOnline: { type: Boolean, default: false },
    lastStatsAt: { type: Date }
  },
  { timestamps: true }
);

const dashboardUserSchema = new Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    email: { type: String },
    avatar: { type: String }
  },
  { timestamps: true }
);

const socialNotificationSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    platform: { type: String, enum: ["TWITCH", "YOUTUBE", "TIKTOK", "KICK"], required: true, index: true },
    enabled: { type: Boolean, default: true },
    channelId: { type: String },
    mentionRoleId: { type: String },
    customMessage: { type: String, default: "" },
    embedTitle: { type: String },
    embedDescription: { type: String },
    embedColor: { type: String, default: "#5865F2" },
    thumbnailUrl: { type: String },
    buttonLabel: { type: String },
    buttonUrl: { type: String },
    updatedBy: { type: String }
  },
  { timestamps: true }
);

socialNotificationSchema.index({ guildId: 1, platform: 1 }, { unique: true });

const twitchSubscriberSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    discordUserId: { type: String, required: true },
    twitchUserId: { type: String, required: true },
    twitchLogin: { type: String, required: true },
    isFollowing: { type: Boolean, default: false },
    isSubscriber: { type: Boolean, default: false },
    isVip: { type: Boolean, default: false },
    isModerator: { type: Boolean, default: false },
    activeRoleIds: { type: [String], default: [] },
    lastCheckedAt: { type: Date }
  },
  { timestamps: true }
);

twitchSubscriberSchema.index({ guildId: 1, discordUserId: 1 }, { unique: true });
twitchSubscriberSchema.index({ guildId: 1, twitchUserId: 1 }, { unique: true });

const guildLogSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    type: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    message: { type: String, required: true },
    userId: { type: String },
    targetId: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

guildLogSchema.index({ createdAt: -1 });

const guildSettingSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
    updatedBy: { type: String }
  },
  { timestamps: true }
);

guildSettingSchema.index({ guildId: 1, key: 1 }, { unique: true });

export const DashboardGuild =
  mongoose.models.DashboardGuild || mongoose.model("DashboardGuild", dashboardGuildSchema);

export const DashboardUser =
  mongoose.models.DashboardUser || mongoose.model("DashboardUser", dashboardUserSchema);

export const SocialNotification =
  mongoose.models.SocialNotification || mongoose.model("SocialNotification", socialNotificationSchema);

export const TwitchSubscriber =
  mongoose.models.TwitchSubscriber || mongoose.model("TwitchSubscriber", twitchSubscriberSchema);

export const GuildLog =
  mongoose.models.GuildLog || mongoose.model("GuildLog", guildLogSchema);

export const GuildSetting =
  mongoose.models.GuildSetting || mongoose.model("GuildSetting", guildSettingSchema);
