import { Router } from "express";
import { z } from "zod";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder
} from "@discordjs/builders";
import { ButtonStyle, MessageFlags, SeparatorSpacingSize } from "discord.js";
import { requireAuth } from "../auth";
import { env } from "../env";
import { LiveAdminLog, TwitchLiveConfig } from "../models/twitchLiveConfig";
import { connectMongo } from "../services/mongo";
import { getTwitchStreamByUserId, getTwitchUserByLogin } from "../services/twitch";
import {
  assertCanManageLives,
  fetchGuild,
  listDiscordAlertChannels,
  resolveLiveAlertChannel,
  sendDiscordChannelMessage,
  fetchDiscordChannelMessage,
  editDiscordChannelMessage,
  validateDiscordAlertChannel
} from "../services/discordGuild";

export const socialLiveRoutes = Router();

const twitchConfigSchema = z.object({
  twitchChannelName: z.string().trim().min(2).max(160).optional().or(z.literal("")),
  liveUrl: z.string().trim().min(2).max(240).optional().or(z.literal("")),
  discordChannelId: z.string().trim().regex(/^\d{17,20}$/).optional().or(z.literal("")),
  alertMessage: z.string().trim().min(3).max(500),
  customMessage: z.string().trim().min(3).max(500).optional().or(z.literal("")),
  mentionRoleId: z.string().trim().regex(/^\d{17,20}$/).optional().or(z.literal("")),
  bannerUrl: z.string().trim().url().optional().or(z.literal("")),
  enabled: z.boolean().default(true)
});

function resolveTwitchChannelName(payload: z.infer<typeof twitchConfigSchema>) {
  const rawValue = payload.liveUrl || payload.twitchChannelName || "";
  const value = rawValue.trim();

  if (!value) {
    throw new Error("Informe o link da live da Twitch.");
  }

  const match = value.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([^/?#\s]+)/i);
  const channelName = (match?.[1] || value).replace(/^@/, "").trim().toLowerCase();

  if (!/^[a-z0-9_]{2,80}$/.test(channelName)) {
    throw new Error("Informe um link valido da Twitch, exemplo: https://twitch.tv/nome_do_canal.");
  }

  return channelName;
}

async function logLiveAction(action: string, userId?: string, configId?: string, message?: string, metadata?: unknown) {
  await connectMongo();
  await LiveAdminLog.create({
    guildId: env.guildId,
    action,
    userId,
    configId,
    message,
    metadata
  });
}

function serializeConfig(config: any) {
  return {
    id: String(config._id),
    guildId: config.guildId,
    platform: config.platform,
    twitchChannelName: config.twitchChannelName,
    liveUrl: config.liveUrl || `https://twitch.tv/${config.twitchChannelName}`,
    twitchDisplayName: config.twitchDisplayName,
    twitchAvatarUrl: config.twitchAvatarUrl,
    discordChannelId: config.discordChannelId,
    alertMessage: config.alertMessage,
    customMessage: config.customMessage || config.alertMessage,
    mentionRoleId: config.mentionRoleId || "",
    bannerUrl: config.bannerUrl || "",
    enabled: config.enabled,
    lastLiveId: config.lastLiveId || config.lastStreamId || "",
    lastLiveStartedAt: config.lastLiveStartedAt || null,
    lastAlertMessageId: config.lastAlertMessageId || "",
    createdBy: config.createdBy,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };
}

type TwitchStream = {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_name: string;
  title: string;
  thumbnail_url: string;
  started_at: string;
  viewer_count: number;
};

const LIVE_PANEL_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function formatDetectedAt(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatLiveTime(startedAt: string | Date) {
  const start = new Date(startedAt).getTime();
  const diff = Math.max(0, Date.now() - start);
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  if (hours <= 0) return `${minutes}min`;
  return `${hours}h ${String(minutes).padStart(2, "0")}min`;
}

function resolveCustomMessage(config: any, stream: TwitchStream) {
  const fallback = `${stream.user_name} está ao vivo na Twitch!`;
  const customMessage = config.customMessage || "";

  if (!customMessage.trim()) return fallback;
  if (customMessage.trim().toLowerCase() === "live cadastrada pelo dashboard.") return "";

  return customMessage
    .replaceAll("{streamer}", stream.user_name)
    .replaceAll("{channel}", stream.user_login)
    .replaceAll("{title}", stream.title);
}

function buildTwitchLiveComponents(config: any, stream: TwitchStream, options: { guildName: string; ended?: boolean }) {
  const streamUrl = `https://twitch.tv/${stream.user_login || config.twitchChannelName}`;
  const thumbnail = stream.thumbnail_url.replace("{width}", "1280").replace("{height}", "720");
  const detectedAt = new Date();
  const liveTitle = truncateText(stream.title || "Live sem titulo", 90);
  const gameName = stream.game_name || "Sem categoria";
  const startedAt = new Date(stream.started_at);
  const statusLine = options.ended ? "## LIVE ENCERRADA" : `## [ ${gameName} ] ${liveTitle}`;
  const headerLines = [
    `### **${stream.user_name} está ao vivo na Twitch!**`,
    "",
    statusLine
  ];

  const info = [
    "🎮 **Game**",
    gameName,
    "",
    "👥 **Viewers**",
    String(stream.viewer_count ?? 0),
    "",
    "🕒 **Início**",
    formatDetectedAt(startedAt),
    "",
    "⏱️ **Tempo Ao Vivo**",
    formatLiveTime(startedAt),
    "",
    "━━━━━━━━━━━━━━━━━━━━"
  ].join("\n\n");

  const container = new ContainerBuilder()
    .setAccentColor(options.ended ? 0x6b7280 : 0x9146ff)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerLines.join("\n")))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(info))
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(config.bannerUrl || thumbnail).setDescription(liveTitle)
      )
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# ${options.guildName} • Atualizado em tempo real • ${formatDetectedAt(detectedAt)}`)
    );

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    options.ended
      ? new ButtonBuilder()
        .setCustomId(`live-ended:${stream.user_id}`)
        .setLabel("Live encerrada")
        .setStyle(ButtonStyle.Secondary)
        .setEmoji({ name: "⚫" })
        .setDisabled(true)
      : new ButtonBuilder()
        .setLabel("Assistir Live")
        .setStyle(ButtonStyle.Link)
        .setURL(streamUrl)
        .setEmoji({ name: "🔴" })
  );

  const components = config.mentionRoleId
    ? [new TextDisplayBuilder().setContent(`<@&${config.mentionRoleId}>`).toJSON(), container.toJSON(), buttonRow.toJSON()]
    : [container.toJSON(), buttonRow.toJSON()];

  return {
    streamUrl,
    components
  };
}

async function sendLiveAlertIfNeeded(config: any) {
  const stream = await getTwitchStreamByUserId(config.twitchUserId);
  const live = stream.data[0];
  const guild = await fetchGuild(env.guildId).catch(() => ({ name: "Ricardinho" }));
  const guildName = guild.name || "Ricardinho";

  if (!live) {
    if (!config.lastIsLive || !config.lastAlertMessageId) return false;

    const endedStream = {
      id: config.lastLiveId || config.lastStreamId || "ended",
      user_id: config.twitchUserId,
      user_login: config.twitchChannelName,
      user_name: config.twitchDisplayName || config.twitchChannelName,
      game_name: "Live encerrada",
      title: "LIVE ENCERRADA",
      thumbnail_url: config.bannerUrl || config.twitchAvatarUrl || "https://static-cdn.jtvnw.net/ttv-static/404_preview-1280x720.jpg",
      started_at: config.lastLiveStartedAt || new Date(),
      viewer_count: 0
    } as TwitchStream;
    const panel = buildTwitchLiveComponents(config, endedStream, { guildName, ended: true });

    await editDiscordChannelMessage(config.discordChannelId, config.lastAlertMessageId, {
      components: panel.components,
      flags: MessageFlags.IsComponentsV2
    }).catch(() => null);

    config.lastIsLive = false;
    config.lastAlertUpdatedAt = new Date();
    await config.save();
    await logLiveAction("live encerrada", undefined, String(config._id), config.twitchChannelName);
    return false;
  }

  const alreadyProcessedLive = (config.lastLiveId || config.lastStreamId) === live.id;

  if (alreadyProcessedLive && config.lastAlertMessageId) {
    const existingMessage = await fetchDiscordChannelMessage(config.discordChannelId, config.lastAlertMessageId).catch(() => null);
    const lastUpdatedAt = config.lastAlertUpdatedAt ? new Date(config.lastAlertUpdatedAt).getTime() : 0;

    if (existingMessage && Date.now() - lastUpdatedAt < LIVE_PANEL_UPDATE_INTERVAL_MS) {
      return false;
    }

    if (existingMessage) {
      const panel = buildTwitchLiveComponents(config, live, { guildName });
      await editDiscordChannelMessage(config.discordChannelId, config.lastAlertMessageId, {
        allowed_mentions: config.mentionRoleId ? { roles: [config.mentionRoleId] } : undefined,
        components: panel.components,
        flags: MessageFlags.IsComponentsV2
      });

      config.lastIsLive = true;
      config.lastAlertUpdatedAt = new Date();
      config.lastLiveStartedAt = new Date(live.started_at);
      await config.save();
      await logLiveAction("alerta atualizado", undefined, String(config._id), live.title, {
        liveId: live.id,
        messageId: config.lastAlertMessageId
      });
      return false;
    }

    await logLiveAction("alerta reenviado", undefined, String(config._id), "Mensagem anterior nao foi encontrada no canal.", {
      liveId: live.id,
      previousMessageId: config.lastAlertMessageId
    });
  }

  if (alreadyProcessedLive && !config.lastAlertMessageId) {
    await logLiveAction("alerta reenviado", undefined, String(config._id), "Registro antigo sem ID da mensagem enviada.", {
      liveId: live.id
    });
  }

  await validateDiscordAlertChannel(config.discordChannelId, env.guildId, config.mentionRoleId || undefined);
  const panel = buildTwitchLiveComponents(config, live, { guildName });

  const sentMessage = await sendDiscordChannelMessage(config.discordChannelId, {
    allowed_mentions: config.mentionRoleId ? { roles: [config.mentionRoleId] } : undefined,
    components: panel.components,
    flags: MessageFlags.IsComponentsV2
  }) as { id?: string };

  config.lastLiveId = live.id;
  config.lastLiveStartedAt = new Date(live.started_at);
  config.lastStreamId = live.id;
  config.lastAlertMessageId = sentMessage.id || config.lastAlertMessageId || "";
  config.lastAlertUpdatedAt = new Date();
  config.lastIsLive = true;
  await config.save();
  await logLiveAction("alerta enviado com sucesso", undefined, String(config._id), live.title, {
    streamUrl: panel.streamUrl,
    liveId: live.id,
    messageId: sentMessage.id
  });

  return true;
}

socialLiveRoutes.get("/", requireAuth, async (request, response, next) => {
  try {
    await assertCanManageLives(request.user!.id);
    await connectMongo();

    const configs = await TwitchLiveConfig.find({ guildId: env.guildId, platform: "twitch" }).sort({ createdAt: -1 });
    response.json({
      guildId: env.guildId,
      limit: 5,
      loggedInAs: request.user!.username,
      twitch: configs.map(serializeConfig)
    });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.get("/channels", requireAuth, async (request, response, next) => {
  try {
    await assertCanManageLives(request.user!.id);
    const channels = await listDiscordAlertChannels(env.guildId).catch((error) => {
      console.warn("Nao foi possivel listar canais de texto do Discord.", error);
      return [];
    });
    const liveAlertChannel = await resolveLiveAlertChannel(env.guildId).catch(() => ({
      id: env.liveAlertChannelId,
      name: env.liveAlertChannelName,
      type: 0,
      parentId: null
    }));
    const hasConfiguredChannel = channels.some((channel) => channel.id === liveAlertChannel.id);
    response.json({
      channels: hasConfiguredChannel
        ? channels
        : [
            ...channels,
            liveAlertChannel
          ],
      liveAlertChannelId: liveAlertChannel.id
    });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.post("/twitch", requireAuth, async (request, response, next) => {
  try {
    await assertCanManageLives(request.user!.id);
    const payload = twitchConfigSchema.parse(request.body);
    const twitchChannelName = resolveTwitchChannelName(payload);
    const liveAlertChannel = await resolveLiveAlertChannel(env.guildId);
    const discordChannelId = liveAlertChannel.id;

    await connectMongo();

    const count = await TwitchLiveConfig.countDocuments({ guildId: env.guildId, platform: "twitch" });
    if (count >= 5) {
      response.status(400).json({ error: "Limite de 5 canais Twitch atingido neste servidor." });
      return;
    }

    const duplicate = await TwitchLiveConfig.findOne({
      guildId: env.guildId,
      platform: "twitch",
      twitchChannelName
    }).collation({ locale: "en", strength: 2 });

    if (duplicate) {
      response.status(409).json({ error: "Este canal Twitch ja esta cadastrado neste servidor." });
      return;
    }

    const mentionRoleId = payload.mentionRoleId || env.liveMentionRoleId || "";

    await validateDiscordAlertChannel(discordChannelId, env.guildId, mentionRoleId || undefined);
    const twitchUser = await getTwitchUserByLogin(twitchChannelName);

    if (!twitchUser.data.length) {
      await logLiveAction("erro ao buscar live", request.user!.id, undefined, "Canal Twitch nao encontrado.", {
        twitchChannelName
      });
      response.status(404).json({ error: "Canal Twitch nao encontrado." });
      return;
    }

    const channel = twitchUser.data[0];
    const config = await TwitchLiveConfig.create({
      guildId: env.guildId,
      platform: "twitch",
      twitchChannelName: channel.login,
      liveUrl: payload.liveUrl || `https://twitch.tv/${channel.login}`,
      twitchUserId: channel.id,
      twitchDisplayName: channel.display_name,
      twitchAvatarUrl: channel.profile_image_url,
      discordChannelId,
      alertMessage: payload.alertMessage,
      customMessage: payload.customMessage || payload.alertMessage,
      mentionRoleId,
      bannerUrl: payload.bannerUrl || "",
      enabled: payload.enabled,
      createdBy: request.user!.id
    });

    await logLiveAction("live cadastrada", request.user!.id, String(config._id), `Twitch ${channel.login}`);
    await sendLiveAlertIfNeeded(config).catch(async (error) => {
      await logLiveAction(
        "erro ao enviar alerta inicial",
        request.user!.id,
        String(config._id),
        error instanceof Error ? error.message : "Erro"
      );
    });
    response.status(201).json({ live: serializeConfig(config) });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.put("/twitch/:id", requireAuth, async (request, response, next) => {
  try {
    await assertCanManageLives(request.user!.id);
    const payload = twitchConfigSchema.partial().parse(request.body);
    await connectMongo();

    const config = await TwitchLiveConfig.findOne({ _id: request.params.id, guildId: env.guildId, platform: "twitch" });
    if (!config) {
      response.status(404).json({ error: "Live nao encontrada neste servidor." });
      return;
    }

    if (payload.discordChannelId && payload.discordChannelId !== config.discordChannelId) {
      await validateDiscordAlertChannel(payload.discordChannelId, env.guildId, payload.mentionRoleId || config.mentionRoleId || undefined);
      await logLiveAction("canal de alerta alterado", request.user!.id, String(config._id), payload.discordChannelId);
    }

    if (payload.mentionRoleId && payload.mentionRoleId !== config.mentionRoleId) {
      await validateDiscordAlertChannel(payload.discordChannelId || config.discordChannelId, env.guildId, payload.mentionRoleId);
    }

    Object.assign(config, {
      discordChannelId: payload.discordChannelId ?? config.discordChannelId,
      alertMessage: payload.alertMessage ?? config.alertMessage,
      customMessage: payload.customMessage ?? config.customMessage,
      mentionRoleId: payload.mentionRoleId ?? config.mentionRoleId,
      bannerUrl: payload.bannerUrl ?? config.bannerUrl,
      enabled: payload.enabled ?? config.enabled
    });

    await config.save();
    await logLiveAction("live editada", request.user!.id, String(config._id), config.twitchChannelName);
    response.json({ live: serializeConfig(config) });
  } catch (error) {
    next(error);
  }
});

socialLiveRoutes.delete("/twitch/:id", requireAuth, async (request, response, next) => {
  try {
    await assertCanManageLives(request.user!.id);
    await connectMongo();

    const config = await TwitchLiveConfig.findOneAndDelete({
      _id: request.params.id,
      guildId: env.guildId,
      platform: "twitch"
    });

    if (!config) {
      response.status(404).json({ error: "Live nao encontrada neste servidor." });
      return;
    }

    await logLiveAction("live removida", request.user!.id, String(config._id), config.twitchChannelName);
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
    const configs = await TwitchLiveConfig.find({ guildId: env.guildId, platform: "twitch", enabled: true });
    let sent = 0;

    for (const config of configs) {
      try {
        const wasSent = await sendLiveAlertIfNeeded(config);
        if (wasSent) sent += 1;
      } catch (error) {
        await logLiveAction("erro ao buscar live", undefined, String(config._id), error instanceof Error ? error.message : "Erro");
      }
    }

    response.json({ checked: configs.length, sent });
  } catch (error) {
    next(error);
  }
});
