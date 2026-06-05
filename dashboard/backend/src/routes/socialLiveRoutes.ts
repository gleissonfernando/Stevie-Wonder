import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth";
import {
  discordGuildIconUrl,
  fetchDiscordUserGuilds,
  refreshDiscordToken
} from "../discord";
import { env } from "../env";
import {
  assertCanManageGuild,
  fetchGuild,
  hasGuildManagementPermission,
  listDiscordAlertChannels,
  sendDiscordChannelMessage,
  validateDiscordAlertChannel
} from "../services/discordGuild";
import { extractTwitchLogin, getTwitchStreamByUserId, getTwitchUserByLogin } from "../services/twitch";
import { ensureDashboardGuild, recordGuildLog, serializeGuildLog } from "../services/dashboardData";
import { emitBotEvent, emitGuildEvent } from "../socket/dashboardSocket";
import { connectMongo } from "../services/mongo";
import { DashboardUser } from "../models/dashboardRealtime";
import { TwitchLiveConfig } from "../models/twitchLiveConfig";
import { decryptToken, encryptToken } from "../secureTokens";

export const socialLiveRoutes = Router();

const DEFAULT_TWITCH_ALERT_URL = "https://www.twitch.tv/ricardinn98";
const LIVE_ALERT_DEFAULTS = {
  customMessage: "@everyone",
  embedTitle: "{streamer} is now live on Twitch!",
  embedDescription: "@{login} {title}",
  embedColor: "#9146FF",
  buttonLabel: "Watch Stream"
} as const;

const alertSchema = z.object({
  guildId: z.string().trim().regex(/^\d{17,20}$/),
  streamerUrl: z.string().trim().min(8).max(240),
  textChannelId: z.string().trim().regex(/^\d{17,20}$/),
  mentionRoleId: z.string().trim().regex(/^\d{17,20}$/).optional().or(z.literal("")),
  customMessage: z.string().trim().min(3).max(1000),
  embedTitle: z.string().trim().max(120).optional().or(z.literal("")),
  embedDescription: z.string().trim().max(1000).optional().or(z.literal("")),
  embedColor: z.string().trim().regex(/^#?[0-9a-fA-F]{6}$/).default("#9146FF"),
  thumbnailUrl: z.string().trim().url().optional().or(z.literal("")),
  buttonLabel: z.string().trim().max(80).default(LIVE_ALERT_DEFAULTS.buttonLabel),
  enabled: z.boolean().default(true)
});

const updateAlertSchema = alertSchema
  .partial()
  .extend({
    enabled: z.boolean().optional()
  });

function serializeAlert(alert: any) {
  return {
    id: String(alert._id || alert.id),
    userIdDiscord: alert.userIdDiscord || alert.createdBy,
    guildId: alert.guildId,
    streamerUrl: alert.streamerUrl || alert.liveUrl || DEFAULT_TWITCH_ALERT_URL,
    streamerName: alert.streamerName || alert.twitchDisplayName || alert.twitchChannelName,
    twitchUserId: alert.twitchUserId,
    twitchAvatarUrl: alert.twitchAvatarUrl,
    textChannelId: alert.textChannelId || alert.discordChannelId,
    mentionRoleId: alert.mentionRoleId || "",
    customMessage: alert.customMessage || alert.alertMessage || LIVE_ALERT_DEFAULTS.customMessage,
    embedTitle: alert.embedTitle || LIVE_ALERT_DEFAULTS.embedTitle,
    embedDescription: alert.embedDescription || LIVE_ALERT_DEFAULTS.embedDescription,
    embedColor: alert.embedColor || LIVE_ALERT_DEFAULTS.embedColor,
    thumbnailUrl: alert.thumbnailUrl || alert.bannerUrl || "",
    buttonLabel: alert.buttonLabel || LIVE_ALERT_DEFAULTS.buttonLabel,
    enabled: alert.enabled,
    lastStreamId: alert.lastStreamId || alert.lastLiveId,
    lastLiveStartedAt: alert.lastLiveStartedAt || alert.lastLiveStartedAt,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt
  };
}

function normalizeColor(value?: string | null) {
  const color = value || LIVE_ALERT_DEFAULTS.embedColor;
  return color.startsWith("#") ? color.toUpperCase() : `#${color.toUpperCase()}`;
}

function colorToDiscordInt(value?: string | null) {
  const parsed = Number.parseInt(normalizeColor(value).replace("#", ""), 16);
  return Number.isNaN(parsed) ? Number.parseInt(LIVE_ALERT_DEFAULTS.embedColor.replace("#", ""), 16) : parsed;
}

function streamThumbnail(url?: string | null) {
  if (!url) return "";
  return url.replace("{width}", "1280").replace("{height}", "720");
}

function buildLiveAlertBody(alert: any, stream: any) {
  const fallbackLogin = stream.user_login || alert.twitchChannelName || alert.streamerName;
  const url =
    alert.streamerUrl ||
    alert.liveUrl ||
    (fallbackLogin ? `https://www.twitch.tv/${fallbackLogin}` : DEFAULT_TWITCH_ALERT_URL);
  const streamerName = stream.user_name || alert.streamerName || alert.twitchDisplayName || alert.twitchChannelName;
  const liveTitle = stream.title || `${streamerName} is now live`;
  const category = stream.game_name || "No category";
  const viewers = String(stream.viewer_count ?? 0);
  const alertedAt = new Date();
  const alertTime = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(alertedAt);
  const alertDateTime = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(alertedAt);
  const login = fallbackLogin || streamerName;
  const imageUrl = streamThumbnail(stream.thumbnail_url);

  return {
    content: LIVE_ALERT_DEFAULTS.customMessage,
    allowed_mentions: { parse: ["everyone"] },
    embeds: [
      {
        color: colorToDiscordInt(LIVE_ALERT_DEFAULTS.embedColor),
        author: {
          name: `${streamerName} is now live on Twitch!`,
          icon_url: alert.twitchAvatarUrl || undefined
        },
        description: `@${login} ${liveTitle}`,
        fields: [
          { name: "Game", value: category, inline: true },
          { name: "Viewers", value: viewers, inline: true }
        ],
        image: imageUrl ? { url: imageUrl } : undefined,
        footer: {
          text: `${login} lives - Hoje às ${alertTime} - ${alertDateTime}`
        },
        timestamp: alertedAt.toISOString(),
        url
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: LIVE_ALERT_DEFAULTS.buttonLabel,
            url
          }
        ]
      }
    ]
  };
}

async function publishTwitchChange(
  action: "created" | "updated" | "toggled" | "deleted" | "live_sent",
  guildId: string,
  alert: any,
  userId?: string
) {
  const serialized = alert ? serializeAlert(alert) : null;
  const streamerName = serialized?.streamerName || alert?.twitchChannelName || "canal";
  const log = await recordGuildLog({
    guildId,
    type: action === "live_sent" ? "live" : "settings",
    action: `twitch_channel_${action}`,
    message:
      action === "live_sent"
        ? `Alerta de live enviado para ${streamerName}.`
        : `Canal Twitch ${streamerName} ${action}.`,
    userId: userId || null,
    metadata: serialized
  });

  emitGuildEvent(guildId, `twitch:channel.${action}`, { alert: serialized });
  emitGuildEvent(guildId, "guild:log", { log: serializeGuildLog(log) });
  emitBotEvent("dashboard:twitchChannelChanged", { guildId, action, alert: serialized });
}

async function resolveAuthorizedGuilds(userId: string, accessToken?: string, sessionGuilds: any[] = []) {
  if (env.authorizedUserIds.includes(userId) && env.guildId) {
    const guild = await fetchGuild(env.guildId);
    await ensureDashboardGuild(guild.id, {
      name: guild.name || guild.id,
      icon: guild.icon ? discordGuildIconUrl({ id: guild.id, name: guild.name || guild.id, icon: guild.icon }) : null
    }).catch(() => null);

    return [
      {
        id: guild.id,
        name: guild.name || guild.id,
        icon: discordGuildIconUrl({
          id: guild.id,
          name: guild.name || guild.id,
          icon: guild.icon || null
        }),
        owner: guild.owner_id === userId
      }
    ];
  }

  let mongoAvailable = true;
  let dashboardUser: any = null;
  try {
    await connectMongo();
    dashboardUser = (await DashboardUser.findOne({ discordId: userId })
      .select("+discordAccessToken +discordRefreshToken")
      .lean()) as any;
  } catch (error) {
    mongoAvailable = false;
    console.warn("Falha ao consultar usuario no Mongo; usando servidores da sessao.", error);
  }

  const cachedGuilds = Array.isArray(dashboardUser?.guilds) && dashboardUser.guilds.length
    ? dashboardUser.guilds
    : sessionGuilds;
  const manageableCachedGuilds = () =>
    cachedGuilds
      .filter((guild: any) => guild.canManage)
      .map((guild: any) => ({
        id: String(guild.id),
        name: String(guild.name || guild.id),
        icon: guild.icon || null,
        owner: Boolean(guild.owner)
      }));
  let resolvedAccessToken = accessToken || decryptToken(dashboardUser?.discordAccessToken as string | undefined);

  const expiresAt = dashboardUser?.discordTokenExpiresAt
    ? new Date(dashboardUser.discordTokenExpiresAt).getTime()
    : 0;

  if (resolvedAccessToken && expiresAt && expiresAt <= Date.now() + 60_000) {
    const refreshToken = decryptToken(dashboardUser?.discordRefreshToken as string | undefined);
    if (refreshToken) {
      const refreshed = await refreshDiscordToken(refreshToken);
      resolvedAccessToken = refreshed.access_token;
      const refreshUpdate: Record<string, unknown> = {
        discordAccessToken: encryptToken(refreshed.access_token),
        discordTokenExpiresAt: new Date(Date.now() + Number(refreshed.expires_in || 604800) * 1000),
        discordScopes: String(refreshed.scope || env.discordOauthScopes)
          .split(/\s+/)
          .filter(Boolean)
      };

      if (refreshed.refresh_token) {
        refreshUpdate.discordRefreshToken = encryptToken(refreshed.refresh_token);
      }

      if (mongoAvailable) {
        await DashboardUser.updateOne(
          { discordId: userId },
          {
            $set: refreshUpdate
          }
        );
      }
    }
  }

  if (!resolvedAccessToken) {
    return manageableCachedGuilds();
  }

  let guilds;
  try {
    guilds = await fetchDiscordUserGuilds(resolvedAccessToken);
  } catch (error) {
    const cached = manageableCachedGuilds();
    if (cached.length) return cached;
    throw error;
  }

  const serializedGuilds = guilds.map((guild) => ({
    id: guild.id,
    name: guild.name,
    icon: discordGuildIconUrl(guild),
    owner: Boolean(guild.owner),
    permissions: guild.permissions || "0",
    canManage: hasGuildManagementPermission(guild.permissions, guild.owner)
  }));

  const authorizedGuilds = serializedGuilds
    .filter((guild) => guild.canManage)
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon,
      owner: guild.owner
    }));

  if (mongoAvailable) {
    await DashboardUser.updateOne({ discordId: userId }, { $set: { guilds: serializedGuilds } });
  }

  await Promise.all(
    authorizedGuilds.map((guild) =>
      ensureDashboardGuild(guild.id, {
        name: guild.name,
        icon: guild.icon
      }).catch(() => null)
    )
  );

  return authorizedGuilds;
}

async function sendLiveAlertIfNeeded(alert: any) {
  if (!alert.enabled || !alert.twitchUserId) return false;

  const stream = await getTwitchStreamByUserId(alert.twitchUserId);
  const live = stream.data[0];

  if (!live || alert.lastStreamId === live.id) {
    return false;
  }

  const textChannelId = alert.textChannelId || alert.discordChannelId;
  await validateDiscordAlertChannel(textChannelId, alert.guildId);
  await sendDiscordChannelMessage(textChannelId, buildLiveAlertBody(alert, live));

  const updated = await TwitchLiveConfig.findByIdAndUpdate(
    alert._id || alert.id,
    {
      $set: {
        mentionRoleId: null,
        alertMessage: LIVE_ALERT_DEFAULTS.customMessage,
        customMessage: LIVE_ALERT_DEFAULTS.customMessage,
        embedTitle: LIVE_ALERT_DEFAULTS.embedTitle,
        embedDescription: LIVE_ALERT_DEFAULTS.embedDescription,
        embedColor: LIVE_ALERT_DEFAULTS.embedColor,
        thumbnailUrl: null,
        bannerUrl: null,
        buttonLabel: LIVE_ALERT_DEFAULTS.buttonLabel,
        lastStreamId: live.id,
        lastLiveId: live.id,
        lastLiveStartedAt: new Date(live.started_at),
        lastAlertSentAt: new Date(),
        lastAlertUpdatedAt: new Date(),
        lastIsLive: true
      }
    },
    { new: true }
  ).lean();

  if (updated) {
    await publishTwitchChange("live_sent", alert.guildId, updated).catch(() => null);
  }

  return true;
}

socialLiveRoutes.get("/guilds", requireAuth, async (request, response, next) => {
  try {
    const guilds = await resolveAuthorizedGuilds(request.user!.id, request.user!.accessToken, request.user!.guilds || []);
    response.json({ guilds });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.get("/guilds/:guildId/channels", requireAuth, async (request, response, next) => {
  try {
    const guildId = String(request.params.guildId);
    await assertCanManageGuild(request.user!.id, guildId);
    const channels = await listDiscordAlertChannels(guildId);
    response.json({ channels });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.get("/", requireAuth, async (request, response, next) => {
  try {
    const guildId = String(request.query.guildId || "");

    if (guildId) {
      await assertCanManageGuild(request.user!.id, guildId);
    }

    await connectMongo();
    const alerts = await TwitchLiveConfig.find(guildId ? { guildId } : { createdBy: request.user!.id })
      .sort({ createdAt: -1 })
      .lean();

    response.json({ alerts: alerts.map(serializeAlert), twitch: alerts.map(serializeAlert) });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.get("/channels", requireAuth, async (request, response, next) => {
  try {
    const guildId = String(request.query.guildId || env.guildId || "");
    if (!guildId) {
      response.json({ channels: [] });
      return;
    }

    await assertCanManageGuild(request.user!.id, guildId);
    const channels = await listDiscordAlertChannels(guildId);
    response.json({ channels });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.post("/twitch", requireAuth, async (request, response, next) => {
  try {
    const payload = alertSchema.parse(request.body);
    await assertCanManageGuild(request.user!.id, payload.guildId);
    await validateDiscordAlertChannel(payload.textChannelId, payload.guildId);

    const login = extractTwitchLogin(payload.streamerUrl);
    if (!login) {
      response.status(400).json({ error: "Informe uma URL valida da Twitch, exemplo: https://www.twitch.tv/usuario." });
      return;
    }

    const twitchUser = await getTwitchUserByLogin(login);
    const channel = twitchUser.data[0];

    if (!channel) {
      response.status(404).json({ error: "Canal Twitch nao encontrado." });
      return;
    }

    await connectMongo();
    const alert = await TwitchLiveConfig.create({
      guildId: payload.guildId,
      platform: "twitch",
      twitchChannelName: channel.login,
      liveUrl: `https://www.twitch.tv/${channel.login}`,
      twitchDisplayName: channel.display_name || channel.login,
      twitchUserId: channel.id,
      twitchAvatarUrl: channel.profile_image_url,
      discordChannelId: payload.textChannelId,
      mentionRoleId: null,
      alertMessage: LIVE_ALERT_DEFAULTS.customMessage,
      customMessage: LIVE_ALERT_DEFAULTS.customMessage,
      embedTitle: LIVE_ALERT_DEFAULTS.embedTitle,
      embedDescription: LIVE_ALERT_DEFAULTS.embedDescription,
      embedColor: LIVE_ALERT_DEFAULTS.embedColor,
      thumbnailUrl: null,
      bannerUrl: null,
      buttonLabel: LIVE_ALERT_DEFAULTS.buttonLabel,
      enabled: payload.enabled,
      createdBy: request.user!.id
    });

    await publishTwitchChange("created", alert.guildId, alert, request.user!.id);
    response.status(201).json({ alert: serializeAlert(alert), live: serializeAlert(alert) });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.put("/twitch/:id", requireAuth, async (request, response, next) => {
  try {
    const id = String(request.params.id);
    await connectMongo();
    const existing = await TwitchLiveConfig.findById(id);
    if (!existing) {
      response.status(404).json({ error: "Alerta de live nao encontrado." });
      return;
    }

    await assertCanManageGuild(request.user!.id, existing.guildId);
    const payload = updateAlertSchema.parse(request.body);
    const guildId = payload.guildId || existing.guildId;
    const textChannelId = payload.textChannelId || existing.discordChannelId;

    if (payload.guildId) {
      await assertCanManageGuild(request.user!.id, payload.guildId);
    }

    if (payload.textChannelId || payload.guildId) {
      await validateDiscordAlertChannel(textChannelId, guildId);
    }

    let twitchData = {};
    if (payload.streamerUrl && payload.streamerUrl !== existing.liveUrl) {
      const login = extractTwitchLogin(payload.streamerUrl);
      if (!login) {
        response.status(400).json({ error: "Informe uma URL valida da Twitch." });
        return;
      }

      const twitchUser = await getTwitchUserByLogin(login);
      const channel = twitchUser.data[0];
      if (!channel) {
        response.status(404).json({ error: "Canal Twitch nao encontrado." });
        return;
      }

      twitchData = {
        liveUrl: `https://www.twitch.tv/${channel.login}`,
        twitchChannelName: channel.login,
        twitchDisplayName: channel.display_name || channel.login,
        twitchUserId: channel.id,
        twitchAvatarUrl: channel.profile_image_url,
        lastStreamId: null,
        lastLiveStartedAt: null,
        lastAlertSentAt: null
      };
    }

    const alert = await TwitchLiveConfig.findByIdAndUpdate(
      existing._id,
      {
        $set: {
          ...twitchData,
          guildId,
          discordChannelId: textChannelId,
          mentionRoleId: null,
          alertMessage: LIVE_ALERT_DEFAULTS.customMessage,
          customMessage: LIVE_ALERT_DEFAULTS.customMessage,
          embedTitle: LIVE_ALERT_DEFAULTS.embedTitle,
          embedDescription: LIVE_ALERT_DEFAULTS.embedDescription,
          embedColor: LIVE_ALERT_DEFAULTS.embedColor,
          thumbnailUrl: null,
          bannerUrl: null,
          buttonLabel: LIVE_ALERT_DEFAULTS.buttonLabel,
          enabled: payload.enabled ?? existing.enabled
        }
      },
      { new: true }
    ).lean();

    const updatedAlert = alert as any;
    await publishTwitchChange("updated", updatedAlert.guildId, updatedAlert, request.user!.id);
    response.json({ alert: serializeAlert(alert), live: serializeAlert(alert) });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.patch("/twitch/:id/toggle", requireAuth, async (request, response, next) => {
  try {
    const id = String(request.params.id);
    await connectMongo();
    const existing = await TwitchLiveConfig.findById(id);
    if (!existing) {
      response.status(404).json({ error: "Alerta de live nao encontrado." });
      return;
    }

    await assertCanManageGuild(request.user!.id, existing.guildId);
    const enabled = Boolean(request.body?.enabled);
    const alert = await TwitchLiveConfig.findByIdAndUpdate(existing._id, { $set: { enabled } }, { new: true }).lean();

    const toggledAlert = alert as any;
    await publishTwitchChange("toggled", toggledAlert.guildId, toggledAlert, request.user!.id);
    response.json({ alert: serializeAlert(alert), live: serializeAlert(alert) });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.delete("/twitch/:id", requireAuth, async (request, response, next) => {
  try {
    const id = String(request.params.id);
    await connectMongo();
    const existing = await TwitchLiveConfig.findById(id);
    if (!existing) {
      response.status(404).json({ error: "Alerta de live nao encontrado." });
      return;
    }

    await assertCanManageGuild(request.user!.id, existing.guildId);
    await TwitchLiveConfig.deleteOne({ _id: existing._id });
    await publishTwitchChange("deleted", existing.guildId, existing, request.user!.id);
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.post("/check", async (request, response, next) => {
  try {
    if (request.headers["x-internal-secret"] !== env.internalWebhookSecret) {
      response.status(401).json({ error: "Nao autorizado." });
      return;
    }

    await connectMongo();
    const alerts = await TwitchLiveConfig.find({ enabled: true }).lean();
    let sent = 0;

    for (const alert of alerts) {
      try {
        const wasSent = await sendLiveAlertIfNeeded(alert);
        if (wasSent) sent += 1;
      } catch (error) {
        console.warn("Falha ao processar alerta de live.", error);
      }
    }

    response.json({ checked: alerts.length, sent });
  } catch (error) {
    next(error);
  }
});
