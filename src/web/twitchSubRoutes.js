const express = require("express");
const { z } = require("zod");
const { LinkedAccount, TwitchSubConfig, TwitchSubLog } = require("../models/dashboard");
const { requireSession } = require("../services/dashboard/auth");
const { fetchDiscordGuilds } = require("../services/dashboard/auth");
const { canManageGuild, filterManageableGuilds, requireGuildAccess } = require("../services/dashboard/permissions");
const { getGuildDashboardData, isDatabaseConnected } = require("../services/dashboard/configStore");
const { encryptToken } = require("../services/twitch/tokenCrypto");
const {
  buildTwitchOAuthUrl,
  createTwitchState,
  ensureEventSubSubscriptions,
  exchangeTwitchCode,
  fetchTwitchUser,
  getTwitchRedirectUri,
  validateEventSubSignature,
  verifyTwitchState
} = require("../services/twitch/twitchApi");
const { handleTwitchSubEvent, testTwitchSubSystem, twitchSubQueue } = require("../services/twitch/subRoleService");
const logger = require("../utils/logger");

const subConfigSchema = z.object({
  guildId: z.string().trim().min(1).max(32),
  subRoleId: z.string().trim().max(32).optional().default(""),
  logChannelId: z.string().trim().max(32).optional().default(""),
  enabled: z.coerce.boolean().optional().default(false),
  customMessage: z.string().trim().max(1200).optional().default("Obrigado pelo sub, {twitchUsername}! Cargo entregue no Discord.")
});

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

async function loadUserGuilds(req, res, next) {
  try {
    req.dashboardUserGuilds = await fetchDiscordGuilds(req.dashboardSession.accessToken);
    next();
  } catch {
    res.status(401).json({ error: "Nao foi possivel validar seus servidores no Discord. Entre novamente." });
  }
}

function sanitizeConfig(config) {
  if (!config) return null;
  const data = typeof config.toObject === "function" ? config.toObject() : { ...config };
  delete data._id;
  delete data.__v;
  delete data.encryptedAccessToken;
  delete data.encryptedRefreshToken;
  return data;
}

function getTokenExpiresAt(token) {
  const seconds = Number(token.expires_in || 0);
  return seconds > 0 ? new Date(Date.now() + seconds * 1000) : null;
}

async function getSubStatus(guildId, userId) {
  const [config, linkedAccount, totalSubs, lastLog] = await Promise.all([
    TwitchSubConfig.findOne({ guildId }).lean(),
    LinkedAccount.findOne({ discordUserId: userId }).lean(),
    TwitchSubLog.countDocuments({ guildId }),
    TwitchSubLog.findOne({ guildId }).sort({ createdAt: -1 }).lean()
  ]);

  return {
    config: sanitizeConfig(config),
    linkedAccount: linkedAccount
      ? {
          discordUserId: linkedAccount.discordUserId,
          discordUsername: linkedAccount.discordUsername,
          twitchUserId: linkedAccount.twitchUserId,
          twitchUsername: linkedAccount.twitchUsername,
          updatedAt: linkedAccount.updatedAt
        }
      : null,
    status: {
      twitchConnected: Boolean(config?.twitchBroadcasterId),
      discordConnected: Boolean(userId),
      roleConfigured: Boolean(config?.subRoleId),
      eventSubActive: Boolean(config?.eventSubSubscriptions?.length),
      lastSubDetected: lastLog?.createdAt || config?.lastSubAt || null,
      lastSubTwitchUsername: lastLog?.twitchUsername || config?.lastSubTwitchUsername || "",
      totalSubsRegistered: totalSubs,
      queue: twitchSubQueue.stats()
    }
  };
}

async function requireGuildQueryAccess(req, res, next) {
  const mode = String(req.query.mode || req.body?.mode || "link") === "broadcaster" ? "broadcaster" : "link";
  if (mode !== "broadcaster") {
    next();
    return;
  }

  const guildId = String(req.query.guildId || req.body?.guildId || "");
  if (!guildId) {
    res.status(400).json({ error: "guildId e obrigatorio." });
    return;
  }

  const userGuilds = req.dashboardUserGuilds || [];
  const userGuild = userGuilds.find((guild) => guild.id === guildId);

  if (!(await canManageGuild(req.dashboardClient, userGuild, req.dashboardSession.user.id))) {
    res.status(403).json({ error: "Voce nao tem permissao para gerenciar este servidor." });
    return;
  }

  req.dashboardGuild = userGuild;
  next();
}

function setupTwitchSubRoutes(router, context) {
  const { client, io } = context;

  router.get(
    "/auth/twitch",
    requireSession,
    loadUserGuilds,
    requireGuildQueryAccess,
    asyncHandler(async (req, res) => {
      const mode = String(req.query.mode || "link") === "broadcaster" ? "broadcaster" : "link";
      const guildId = String(req.query.guildId || "");
      const state = createTwitchState({ guildId, mode, userId: req.dashboardSession.user.id });
      const url = buildTwitchOAuthUrl(state, mode);

      if (req.query.json === "1") {
        res.json({ url, redirectUri: getTwitchRedirectUri() });
        return;
      }

      res.redirect(url);
    })
  );

  router.get(
    "/auth/twitch/callback",
    requireSession,
    asyncHandler(async (req, res) => {
      const code = String(req.query.code || "");
      if (!code) {
        res.redirect("/vincular-conta?error=twitch");
        return;
      }

      const state = verifyTwitchState(req.query.state);
      if (state.userId !== req.dashboardSession.user.id) {
        res.redirect("/vincular-conta?error=session");
        return;
      }

      const token = await exchangeTwitchCode(code);
      const twitchUser = await fetchTwitchUser(token.access_token);

      if (!twitchUser) {
        throw new Error("Nao foi possivel buscar a conta Twitch conectada.");
      }

      const encryptedAccessToken = encryptToken(token.access_token);
      const encryptedRefreshToken = encryptToken(token.refresh_token);
      const tokenExpiresAt = getTokenExpiresAt(token);

      if (state.mode === "broadcaster") {
        const guild = client.guilds.cache.get(state.guildId);
        await TwitchSubConfig.findOneAndUpdate(
          { guildId: state.guildId },
          {
            guildId: state.guildId,
            guildName: guild?.name || "",
            ownerId: req.dashboardSession.user.id,
            twitchBroadcasterId: twitchUser.id,
            twitchBroadcasterName: twitchUser.login || twitchUser.display_name,
            encryptedAccessToken,
            encryptedRefreshToken,
            tokenExpiresAt,
            updatedAt: new Date()
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.redirect(`/dashboard/${state.guildId}/sub-twitch?twitch=connected`);
        return;
      }

      await LinkedAccount.findOneAndUpdate(
        { discordUserId: req.dashboardSession.user.id },
        {
          discordUserId: req.dashboardSession.user.id,
          discordUsername: req.dashboardSession.user.globalName || req.dashboardSession.user.username,
          twitchUserId: twitchUser.id,
          twitchUsername: twitchUser.login || twitchUser.display_name,
          encryptedAccessToken,
          encryptedRefreshToken,
          tokenExpiresAt,
          updatedAt: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      res.redirect("/vincular-conta?linked=1");
    })
  );

  router.post("/link/discord", requireSession, (req, res) => {
    res.json({ ok: true, user: req.dashboardSession.user });
  });

  router.get(
    "/link/status",
    requireSession,
    asyncHandler(async (req, res) => {
      const linked = await LinkedAccount.findOne({ discordUserId: req.dashboardSession.user.id }).lean();
      res.json({
        discord: req.dashboardSession.user,
        twitch: linked
          ? {
              twitchUserId: linked.twitchUserId,
              twitchUsername: linked.twitchUsername,
              updatedAt: linked.updatedAt
            }
          : null
      });
    })
  );

  router.post(
    "/link/twitch",
    requireSession,
    asyncHandler(async (req, res) => {
      const state = createTwitchState({ mode: "link", userId: req.dashboardSession.user.id });
      res.json({ url: buildTwitchOAuthUrl(state, "link"), redirectUri: getTwitchRedirectUri() });
    })
  );

  router.get(
    "/user/guilds",
    requireSession,
    loadUserGuilds,
    asyncHandler(async (req, res) => {
      const guilds = await filterManageableGuilds(client, req.dashboardUserGuilds, req.dashboardSession.user.id);
      res.json({ guilds });
    })
  );

  router.get(
    "/guild/:guildId/roles",
    requireSession,
    loadUserGuilds,
    requireGuildAccess,
    asyncHandler(async (req, res) => {
      const guild = await getGuildDashboardData(client, req.params.guildId);
      res.json({ roles: guild?.roles || [] });
    })
  );

  router.get(
    "/guild/:guildId/channels",
    requireSession,
    loadUserGuilds,
    requireGuildAccess,
    asyncHandler(async (req, res) => {
      const guild = await getGuildDashboardData(client, req.params.guildId);
      res.json({ channels: guild?.channels || [] });
    })
  );

  router.get(
    "/twitch/sub/config/:guildId",
    requireSession,
    loadUserGuilds,
    requireGuildAccess,
    asyncHandler(async (req, res) => {
      res.json(await getSubStatus(req.params.guildId, req.dashboardSession.user.id));
    })
  );

  router.post(
    "/twitch/sub/config",
    requireSession,
    loadUserGuilds,
    asyncHandler(async (req, res, next) => {
      req.params.guildId = req.body.guildId;
      next();
    }),
    requireGuildAccess,
    asyncHandler(async (req, res) => {
      if (!isDatabaseConnected()) {
        throw new Error("MongoDB nao esta conectado.");
      }

      const payload = subConfigSchema.parse(req.body);
      const guild = client.guilds.cache.get(payload.guildId);
      const current = await TwitchSubConfig.findOne({ guildId: payload.guildId }).lean();

      if (payload.enabled && !current?.twitchBroadcasterId) {
        throw new Error("Conecte a Twitch do streamer antes de ativar o sistema.");
      }

      let eventSubSubscriptions = current?.eventSubSubscriptions || [];

      if (payload.enabled) {
        const created = await ensureEventSubSubscriptions({
          ...current,
          ...payload,
          eventSubSubscriptions
        });
        eventSubSubscriptions = [...eventSubSubscriptions, ...created];
      }

      const config = await TwitchSubConfig.findOneAndUpdate(
        { guildId: payload.guildId },
        {
          guildId: payload.guildId,
          guildName: guild?.name || current?.guildName || "",
          ownerId: req.dashboardSession.user.id,
          subRoleId: payload.subRoleId,
          logChannelId: payload.logChannelId,
          enabled: payload.enabled,
          customMessage: payload.customMessage,
          eventSubSubscriptions,
          updatedAt: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      io.to(`guild:${payload.guildId}`).emit("twitch:subConfigUpdated", sanitizeConfig(config));
      res.json({ ok: true, message: "Configuracao de Sub Twitch salva com sucesso", ...(await getSubStatus(payload.guildId, req.dashboardSession.user.id)) });
    })
  );

  router.post(
    "/twitch/sub/test",
    requireSession,
    loadUserGuilds,
    asyncHandler(async (req, res, next) => {
      req.params.guildId = req.body.guildId;
      next();
    }),
    requireGuildAccess,
    asyncHandler(async (req, res) => {
      const result = await testTwitchSubSystem(client, io, {
        guildId: req.body.guildId,
        user: req.dashboardSession.user
      });
      res.json({ ok: true, message: "Teste de cargo Sub Twitch executado com sucesso", result });
    })
  );

  router.post(
    "/twitch/eventsub/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    asyncHandler(async (req, res) => {
      let validSignature = false;

      try {
        validSignature = validateEventSubSignature(req);
      } catch (error) {
        logger.error("EventSub Twitch nao configurado", error);
        res.status(503).send("EventSub Twitch nao configurado.");
        return;
      }

      if (!validSignature) {
        res.status(403).send("Assinatura EventSub invalida.");
        return;
      }

      const body = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
      const messageType = req.get("Twitch-Eventsub-Message-Type");

      if (messageType === "webhook_callback_verification") {
        res.status(200).send(body.challenge);
        return;
      }

      if (messageType === "notification") {
        res.status(204).send();
        handleTwitchSubEvent(client, io, body.subscription?.type, body.event).catch((error) => {
          logger.error("Falha ao processar EventSub Twitch", error);
        });
        return;
      }

      if (messageType === "revocation") {
        logger.warn(`EventSub revogado: ${body.subscription?.type} ${body.subscription?.status}`);
        res.status(204).send();
        return;
      }

      res.status(204).send();
    })
  );
}

module.exports = {
  setupTwitchSubRoutes
};
