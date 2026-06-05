import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth";
import { assertCanManageGuild, fetchGuild, validateDiscordAlertChannel } from "../services/discordGuild";
import { connectMongo } from "../services/mongo";
import { SocialNotification, GuildLog } from "../models/dashboardRealtime";
import { buildGuildOverview, ensureDashboardGuild, recordGuildLog, serializeGuildLog } from "../services/dashboardData";
import { emitBotEvent, emitGuildEvent } from "../socket/dashboardSocket";

export const dashboardSyncRoutes = Router();

const snowflake = z.string().trim().regex(/^\d{17,20}$/);
const platformSchema = z.enum(["TWITCH", "YOUTUBE", "TIKTOK", "KICK"]);
const optionalSnowflake = snowflake.optional().or(z.literal(""));

const socialNotificationSchema = z.object({
  enabled: z.boolean().default(true),
  channelId: optionalSnowflake,
  mentionRoleId: optionalSnowflake,
  customMessage: z.string().trim().max(1000).default(""),
  embedTitle: z.string().trim().max(120).optional().or(z.literal("")),
  embedDescription: z.string().trim().max(1000).optional().or(z.literal("")),
  embedColor: z
    .string()
    .trim()
    .regex(/^#?[0-9a-fA-F]{6}$/)
    .default("#5865F2"),
  thumbnailUrl: z.string().trim().url().optional().or(z.literal("")),
  buttonLabel: z.string().trim().max(80).optional().or(z.literal("")),
  buttonUrl: z.string().trim().url().optional().or(z.literal(""))
});

function docId(doc: any) {
  return String(doc?._id || doc?.id || "");
}

function normalizeColor(value: string) {
  const color = value.startsWith("#") ? value : `#${value}`;
  return color.toUpperCase();
}

function serializeSocialNotification(config: any) {
  return {
    id: docId(config),
    guildId: config.guildId,
    platform: config.platform,
    enabled: Boolean(config.enabled),
    channelId: config.channelId || "",
    mentionRoleId: config.mentionRoleId || "",
    customMessage: config.customMessage || "",
    embedTitle: config.embedTitle || "",
    embedDescription: config.embedDescription || "",
    embedColor: config.embedColor || "#5865F2",
    thumbnailUrl: config.thumbnailUrl || "",
    buttonLabel: config.buttonLabel || "",
    buttonUrl: config.buttonUrl || "",
    updatedAt: config.updatedAt
  };
}

async function ensureGuildAccess(userId: string, guildId: string) {
  await assertCanManageGuild(userId, guildId);
  const guild = await fetchGuild(guildId).catch(() => null);
  await ensureDashboardGuild(guildId, {
    name: guild?.name || guildId,
    icon: guild?.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96` : null
  });
}

dashboardSyncRoutes.get("/guilds/:guildId/overview", requireAuth, async (request, response, next) => {
  try {
    const guildId = snowflake.parse(request.params.guildId);
    await ensureGuildAccess(request.user!.id, guildId);
    response.json(await buildGuildOverview(guildId));
  } catch (error) {
    next(error);
  }
});

dashboardSyncRoutes.get("/guilds/:guildId/logs", requireAuth, async (request, response, next) => {
  try {
    const guildId = snowflake.parse(request.params.guildId);
    await ensureGuildAccess(request.user!.id, guildId);
    await connectMongo();

    const logs = await GuildLog.find({ guildId }).sort({ createdAt: -1 }).limit(80).lean();
    response.json({ logs: logs.map(serializeGuildLog) });
  } catch (error) {
    next(error);
  }
});

dashboardSyncRoutes.get("/guilds/:guildId/social-notifications", requireAuth, async (request, response, next) => {
  try {
    const guildId = snowflake.parse(request.params.guildId);
    await ensureGuildAccess(request.user!.id, guildId);
    await connectMongo();

    const configs = await SocialNotification.find({ guildId }).sort({ platform: 1 }).lean();
    response.json({ configs: configs.map(serializeSocialNotification) });
  } catch (error) {
    next(error);
  }
});

dashboardSyncRoutes.put(
  "/guilds/:guildId/social-notifications/:platform",
  requireAuth,
  async (request, response, next) => {
    try {
      const guildId = snowflake.parse(request.params.guildId);
      const platform = platformSchema.parse(String(request.params.platform).toUpperCase());
      const payload = socialNotificationSchema.parse(request.body);

      await ensureGuildAccess(request.user!.id, guildId);

      if (payload.channelId) {
        await validateDiscordAlertChannel(payload.channelId, guildId, payload.mentionRoleId || undefined);
      }

      await connectMongo();
      const config = await SocialNotification.findOneAndUpdate(
        { guildId, platform },
        {
          $set: {
            enabled: payload.enabled,
            channelId: payload.channelId || undefined,
            mentionRoleId: payload.mentionRoleId || undefined,
            customMessage: payload.customMessage,
            embedTitle: payload.embedTitle || undefined,
            embedDescription: payload.embedDescription || undefined,
            embedColor: normalizeColor(payload.embedColor),
            thumbnailUrl: payload.thumbnailUrl || undefined,
            buttonLabel: payload.buttonLabel || undefined,
            buttonUrl: payload.buttonUrl || undefined,
            updatedBy: request.user!.id
          },
          $setOnInsert: { guildId, platform }
        },
        { upsert: true, new: true }
      ).lean();

      const serialized = serializeSocialNotification(config);
      const log = await recordGuildLog({
        guildId,
        type: "settings",
        action: "social_notification_updated",
        message: `${platform} atualizado pelo dashboard.`,
        userId: request.user!.id,
        metadata: serialized
      });

      emitGuildEvent(guildId, "social:notification.updated", { config: serialized });
      emitGuildEvent(guildId, "guild:log", { log: serializeGuildLog(log) });
      emitBotEvent("dashboard:socialNotificationChanged", { guildId, config: serialized });

      response.json({ config: serialized });
    } catch (error) {
      next(error);
    }
  }
);
