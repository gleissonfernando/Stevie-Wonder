import mongoose, { Schema } from "mongoose";

const twitchLiveConfigSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    platform: { type: String, enum: ["twitch"], default: "twitch", index: true },
    twitchChannelName: { type: String, required: true },
    liveUrl: { type: String },
    twitchUserId: { type: String },
    twitchDisplayName: { type: String },
    twitchAvatarUrl: { type: String },
    discordChannelId: { type: String, required: true },
    alertMessage: { type: String, required: true },
    customMessage: { type: String },
    mentionRoleId: { type: String },
    bannerUrl: { type: String },
    enabled: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
    lastLiveId: { type: String },
    lastLiveStartedAt: { type: Date },
    lastStreamId: { type: String },
    lastAlertMessageId: { type: String },
    lastAlertUpdatedAt: { type: Date },
    lastIsLive: { type: Boolean, default: false }
  },
  { timestamps: true }
);

twitchLiveConfigSchema.index(
  { guildId: 1, platform: 1, twitchChannelName: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

export const TwitchLiveConfig =
  mongoose.models.TwitchLiveConfig || mongoose.model("TwitchLiveConfig", twitchLiveConfigSchema);

const liveAdminLogSchema = new Schema(
  {
    guildId: { type: String, required: true, index: true },
    action: { type: String, required: true, index: true },
    userId: { type: String },
    configId: { type: String },
    message: { type: String },
    metadata: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export const LiveAdminLog =
  mongoose.models.LiveAdminLog || mongoose.model("LiveAdminLog", liveAdminLogSchema);
