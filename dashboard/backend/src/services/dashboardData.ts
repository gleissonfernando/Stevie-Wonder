import { connectMongo } from "./mongo";
import {
  DashboardGuild,
  GuildLog,
  SocialNotification,
  TwitchSubscriber
} from "../models/dashboardRealtime";
import { TwitchLiveConfig } from "../models/twitchLiveConfig";

type GuildStatsInput = {
  name?: string;
  icon?: string | null;
  memberCount?: number;
  onlineCount?: number;
  botCount?: number;
  botOnline?: boolean;
};

type GuildLogInput = {
  guildId: string;
  type: string;
  action: string;
  message: string;
  userId?: string | null;
  targetId?: string | null;
  metadata?: unknown;
};

function docId(doc: any) {
  return String(doc?._id || doc?.id || "");
}

function cleanUndefined(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

export function serializeGuild(guild: any) {
  return {
    id: guild.guildId || guild.id,
    name: guild.name,
    icon: guild.icon || null,
    memberCount: guild.memberCount || 0,
    onlineCount: guild.onlineCount || 0,
    botCount: guild.botCount || 0,
    newMemberCount: guild.newMemberCount || 0,
    leaveCount: guild.leaveCount || 0,
    botOnline: Boolean(guild.botOnline),
    lastStatsAt: guild.lastStatsAt || null,
    updatedAt: guild.updatedAt || null
  };
}

export function serializeGuildLog(log: any) {
  return {
    id: docId(log),
    guildId: log.guildId,
    type: log.type,
    action: log.action,
    message: log.message,
    userId: log.userId || null,
    targetId: log.targetId || null,
    metadata: log.metadata || null,
    createdAt: log.createdAt
  };
}

export async function ensureDashboardGuild(guildId: string, input: GuildStatsInput = {}) {
  await connectMongo();

  const data = cleanUndefined({
    name: input.name,
    icon: input.icon,
    memberCount: input.memberCount,
    onlineCount: input.onlineCount,
    botCount: input.botCount,
    botOnline: input.botOnline,
    lastStatsAt:
      input.memberCount !== undefined ||
      input.onlineCount !== undefined ||
      input.botCount !== undefined ||
      input.botOnline !== undefined
        ? new Date()
        : undefined
  });

  return DashboardGuild.findOneAndUpdate(
    { guildId },
    {
      $set: data,
      $setOnInsert: {
        guildId,
        name: input.name || guildId
      }
    },
    { upsert: true, new: true }
  ).lean();
}

export async function incrementGuildCounter(guildId: string, key: "newMemberCount" | "leaveCount") {
  await connectMongo();

  return DashboardGuild.findOneAndUpdate(
    { guildId },
    {
      $inc: { [key]: 1 },
      $setOnInsert: {
        guildId,
        name: guildId
      }
    },
    { upsert: true, new: true }
  ).lean();
}

export async function recordGuildLog(input: GuildLogInput) {
  await connectMongo();

  return GuildLog.create({
    guildId: input.guildId,
    type: input.type,
    action: input.action,
    message: input.message,
    userId: input.userId || undefined,
    targetId: input.targetId || undefined,
    metadata: input.metadata || undefined
  });
}

export async function buildGuildOverview(guildId: string) {
  await connectMongo();

  const [guild, twitchChannels, activeTwitchChannels, socialNotifications, activeSubs, latestLogs] =
    await Promise.all([
      DashboardGuild.findOne({ guildId }).lean(),
      TwitchLiveConfig.countDocuments({ guildId }),
      TwitchLiveConfig.countDocuments({ guildId, enabled: true }),
      SocialNotification.countDocuments({ guildId }),
      TwitchSubscriber.countDocuments({ guildId, isSubscriber: true }),
      GuildLog.find({ guildId }).sort({ createdAt: -1 }).limit(30).lean()
    ]);

  return {
    guild: guild ? serializeGuild(guild) : null,
    counters: {
      twitchChannels,
      activeTwitchChannels,
      socialNotifications,
      activeSubs
    },
    logs: latestLogs.map(serializeGuildLog)
  };
}
