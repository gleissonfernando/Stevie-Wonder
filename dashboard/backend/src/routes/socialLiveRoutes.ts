import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";
import {
  discordGuildIconUrl,
  fetchDiscordUserGuilds
} from "../discord";
import { env } from "../env";
import {
  assertCanManageGuild,
  hasAdministratorPermission,
  listDiscordAlertChannels,
  sendDiscordChannelMessage,
  validateDiscordAlertChannel
} from "../services/discordGuild";
import { extractTwitchLogin, getTwitchStreamByUserId, getTwitchUserByLogin } from "../services/twitch";

export const socialLiveRoutes = Router();

const alertSchema = z.object({
  guildId: z.string().trim().regex(/^\d{17,20}$/),
  streamerUrl: z.string().trim().min(8).max(240),
  textChannelId: z.string().trim().regex(/^\d{17,20}$/),
  customMessage: z.string().trim().min(3).max(1000),
  enabled: z.boolean().default(true)
});

const updateAlertSchema = alertSchema
  .partial()
  .extend({
    enabled: z.boolean().optional()
  });

function serializeAlert(alert: any) {
  return {
    id: alert.id,
    userIdDiscord: alert.userIdDiscord,
    guildId: alert.guildId,
    streamerUrl: alert.streamerUrl,
    streamerName: alert.streamerName,
    twitchUserId: alert.twitchUserId,
    twitchAvatarUrl: alert.twitchAvatarUrl,
    textChannelId: alert.textChannelId,
    customMessage: alert.customMessage,
    enabled: alert.enabled,
    lastStreamId: alert.lastStreamId,
    lastLiveStartedAt: alert.lastLiveStartedAt,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt
  };
}

function renderCustomMessage(template: string, streamerName: string, streamerUrl: string) {
  return template
    .replaceAll("{streamer}", streamerName)
    .replaceAll("{url}", streamerUrl);
}

function streamThumbnail(url: string) {
  return url.replace("{width}", "1280").replace("{height}", "720");
}

function buildLiveAlertBody(alert: any, stream: any) {
  const url = alert.streamerUrl || `https://www.twitch.tv/${stream.user_login || alert.streamerName}`;
  const streamerName = stream.user_name || alert.streamerName;
  const liveTitle = stream.title || `${streamerName} is now live`;
  const message = renderCustomMessage(alert.customMessage, streamerName, url);

  return {
    content: message,
    allowed_mentions: { parse: ["everyone", "roles", "users"] },
    embeds: [
      {
        color: 0x9146ff,
        author: {
          name: `${streamerName} is now live on Twitch!`,
          icon_url: alert.twitchAvatarUrl || undefined
        },
        description: `@${stream.user_login || alert.streamerName} - ${liveTitle}`,
        fields: [
          { name: "Game", value: stream.game_name || "No category", inline: true },
          { name: "Viewers", value: String(stream.viewer_count ?? 0), inline: true }
        ],
        image: { url: streamThumbnail(stream.thumbnail_url) },
        footer: {
          text: `${stream.user_login || streamerName} lives - Hoje as ${new Intl.DateTimeFormat("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
          }).format(new Date())}`
        }
      }
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "Watch Stream",
            url
          }
        ]
      }
    ]
  };
}

async function resolveAdminGuilds(accessToken?: string) {
  if (!accessToken) return [];

  const guilds = await fetchDiscordUserGuilds(accessToken);

  return guilds
    .filter((guild) => hasAdministratorPermission(guild.permissions, guild.owner))
    .map((guild) => ({
      id: guild.id,
      name: guild.name,
      icon: discordGuildIconUrl(guild),
      owner: Boolean(guild.owner)
    }));
}

async function sendLiveAlertIfNeeded(alert: any) {
  if (!alert.enabled || !alert.twitchUserId) return false;

  const stream = await getTwitchStreamByUserId(alert.twitchUserId);
  const live = stream.data[0];

  if (!live || alert.lastStreamId === live.id) {
    return false;
  }

  await validateDiscordAlertChannel(alert.textChannelId, alert.guildId);
  await sendDiscordChannelMessage(alert.textChannelId, buildLiveAlertBody(alert, live));

  await prisma.liveAlertConfig.update({
    where: { id: alert.id },
    data: {
      lastStreamId: live.id,
      lastLiveStartedAt: new Date(live.started_at),
      lastAlertSentAt: new Date()
    }
  });

  return true;
}

socialLiveRoutes.get("/guilds", requireAuth, async (request, response, next) => {
  try {
    const guilds = await resolveAdminGuilds(request.user!.accessToken);
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

    const alerts = await prisma.liveAlertConfig.findMany({
      where: guildId ? { guildId } : { userIdDiscord: request.user!.id },
      orderBy: { createdAt: "desc" }
    });

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

    const alert = await prisma.liveAlertConfig.create({
      data: {
        userIdDiscord: request.user!.id,
        guildId: payload.guildId,
        streamerUrl: `https://www.twitch.tv/${channel.login}`,
        streamerName: channel.display_name || channel.login,
        twitchUserId: channel.id,
        twitchAvatarUrl: channel.profile_image_url,
        textChannelId: payload.textChannelId,
        customMessage: payload.customMessage,
        enabled: payload.enabled
      }
    });

    response.status(201).json({ alert: serializeAlert(alert), live: serializeAlert(alert) });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.put("/twitch/:id", requireAuth, async (request, response, next) => {
  try {
    const id = String(request.params.id);
    const existing = await prisma.liveAlertConfig.findUnique({ where: { id } });
    if (!existing) {
      response.status(404).json({ error: "Alerta de live nao encontrado." });
      return;
    }

    await assertCanManageGuild(request.user!.id, existing.guildId);
    const payload = updateAlertSchema.parse(request.body);
    const guildId = payload.guildId || existing.guildId;
    const textChannelId = payload.textChannelId || existing.textChannelId;

    if (payload.guildId) {
      await assertCanManageGuild(request.user!.id, payload.guildId);
    }

    if (payload.textChannelId || payload.guildId) {
      await validateDiscordAlertChannel(textChannelId, guildId);
    }

    let twitchData = {};
    if (payload.streamerUrl && payload.streamerUrl !== existing.streamerUrl) {
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
        streamerUrl: `https://www.twitch.tv/${channel.login}`,
        streamerName: channel.display_name || channel.login,
        twitchUserId: channel.id,
        twitchAvatarUrl: channel.profile_image_url,
        lastStreamId: null,
        lastLiveStartedAt: null,
        lastAlertSentAt: null
      };
    }

    const alert = await prisma.liveAlertConfig.update({
      where: { id: existing.id },
      data: {
        ...twitchData,
        guildId,
        textChannelId,
        customMessage: payload.customMessage ?? existing.customMessage,
        enabled: payload.enabled ?? existing.enabled
      }
    });

    response.json({ alert: serializeAlert(alert), live: serializeAlert(alert) });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.patch("/twitch/:id/toggle", requireAuth, async (request, response, next) => {
  try {
    const id = String(request.params.id);
    const existing = await prisma.liveAlertConfig.findUnique({ where: { id } });
    if (!existing) {
      response.status(404).json({ error: "Alerta de live nao encontrado." });
      return;
    }

    await assertCanManageGuild(request.user!.id, existing.guildId);
    const enabled = Boolean(request.body?.enabled);
    const alert = await prisma.liveAlertConfig.update({
      where: { id: existing.id },
      data: { enabled }
    });

    response.json({ alert: serializeAlert(alert), live: serializeAlert(alert) });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.delete("/twitch/:id", requireAuth, async (request, response, next) => {
  try {
    const id = String(request.params.id);
    const existing = await prisma.liveAlertConfig.findUnique({ where: { id } });
    if (!existing) {
      response.status(404).json({ error: "Alerta de live nao encontrado." });
      return;
    }

    await assertCanManageGuild(request.user!.id, existing.guildId);
    await prisma.liveAlertConfig.delete({ where: { id: existing.id } });
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

    const alerts = await prisma.liveAlertConfig.findMany({ where: { enabled: true } });
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
