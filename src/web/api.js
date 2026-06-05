const express = require("express");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const {
  buildDiscordOAuthUrl,
  clearSessionCookie,
  createOAuthState,
  createSignedSession,
  exchangeDiscordCode,
  fetchDiscordGuilds,
  fetchDiscordUser,
  getRedirectUri,
  requireSession,
  setSessionCookie,
  upsertDashboardUser,
  verifyOAuthState
} = require("../services/dashboard/auth");
const { filterManageableGuilds, requireGuildAccess } = require("../services/dashboard/permissions");
const {
  createAuditLog,
  getBotStatus,
  getGuildDashboardData,
  getModuleConfig,
  isDatabaseConnected,
  saveModuleConfig,
  syncGuild
} = require("../services/dashboard/configStore");
const { VerificationConfig } = require("../models/dashboard");
const { noticeSchema, parseModulePayload } = require("../services/dashboard/validators");

const moduleRoutes = {
  config: "config",
  twitch: "twitch",
  welcome: "welcome",
  leave: "leave",
  logs: "logs",
  roles: "roles",
  verification: "verification",
  commands: "commands",
  appearance: "appearance"
};

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function getCommandCatalog(client, savedConfig) {
  const savedByName = new Map((savedConfig.commands || []).map((item) => [item.name, item]));

  const commands = [...(client.commands?.values?.() || [])].map((command) => {
    const data = typeof command.data?.toJSON === "function" ? command.data.toJSON() : command.data;
    const name = data?.name || "comando";
    const saved = savedByName.get(name) || {};

    return {
      name,
      description: data?.description || "Sem descricao.",
      category: command.category || "Bot",
      enabled: saved.enabled ?? true,
      requiredPermission: saved.requiredPermission || "",
      allowedChannelId: saved.allowedChannelId || "",
      allowedRoleId: saved.allowedRoleId || "",
      hiddenWhenDenied: saved.hiddenWhenDenied || false
    };
  });

  return { commands };
}

async function loadUserGuilds(req, res, next) {
  try {
    req.dashboardUserGuilds = await fetchDiscordGuilds(req.dashboardSession.accessToken);
    next();
  } catch {
    res.status(401).json({ error: "Nao foi possivel validar seus servidores no Discord. Entre novamente." });
  }
}

function setupDashboardApi(app, context) {
  const router = express.Router();
  const { botBridge, client, io } = context;

  router.use((req, _res, next) => {
    req.dashboardClient = client;
    req.dashboardSocket = io;
    req.dashboardBotBridge = botBridge;
    next();
  });

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      mongo: isDatabaseConnected(),
      redirectUri: getRedirectUri()
    });
  });

  router.get("/bot/status", (_req, res) => {
    res.json(getBotStatus(client, botBridge.startedAt, io.engine.clientsCount));
  });

  router.post("/auth/discord", (req, res) => {
    const state = createOAuthState(res);
    res.json({ url: buildDiscordOAuthUrl(state), redirectUri: getRedirectUri() });
  });

  router.get("/auth/discord", (req, res) => {
    const state = createOAuthState(res);
    res.redirect(buildDiscordOAuthUrl(state));
  });

  router.get(
    "/auth/discord/callback",
    asyncHandler(async (req, res) => {
      const code = String(req.query.code || "");
      const state = String(req.query.state || "");

      if (!code || !verifyOAuthState(req, res, state)) {
        res.redirect("/login?error=oauth");
        return;
      }

      const token = await exchangeDiscordCode(code);
      const user = await fetchDiscordUser(token.access_token);
      const guilds = await fetchDiscordGuilds(token.access_token);

      if (isDatabaseConnected()) {
        await upsertDashboardUser(user, guilds);
      }

      const session = await createSignedSession({
        user,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresIn: token.expires_in
      });

      setSessionCookie(res, session.token, session.maxAgeMs);
      res.redirect("/dashboard");
    })
  );

  router.get("/auth/me", requireSession, (req, res) => {
    res.json({ user: req.dashboardSession.user });
  });

  router.post(
    "/auth/logout",
    requireSession,
    asyncHandler(async (req, res) => {
      const decoded = jwt.decode(req.cookies?.ricardinn98_session || "");
      if (decoded?.tokenId && isDatabaseConnected()) {
        const { Session } = require("../models/dashboard");
        await Session.updateOne({ tokenId: decoded.tokenId }, { revokedAt: new Date() }).catch(() => null);
      }

      clearSessionCookie(res);
      res.json({ ok: true });
    })
  );

  router.get(
    "/guilds",
    requireSession,
    loadUserGuilds,
    asyncHandler(async (req, res) => {
      const allowed = await filterManageableGuilds(client, req.dashboardUserGuilds, req.dashboardSession.user.id);

      for (const guild of allowed) {
        await syncGuild(client, guild.id);
      }

      res.json({ guilds: allowed });
    })
  );

  router.get(
    "/guilds/:guildId",
    requireSession,
    loadUserGuilds,
    requireGuildAccess,
    asyncHandler(async (req, res) => {
      const guild = await getGuildDashboardData(client, req.params.guildId);
      if (!guild) {
        res.status(404).json({ error: "Bot nao esta no servidor." });
        return;
      }

      res.json({ guild });
    })
  );

  for (const [moduleName, routeName] of Object.entries(moduleRoutes)) {
    router.get(
      `/guilds/:guildId/${routeName}`,
      requireSession,
      loadUserGuilds,
      requireGuildAccess,
      asyncHandler(async (req, res) => {
        const config = await getModuleConfig(moduleName, req.params.guildId);

        if (moduleName === "commands") {
          res.json({ config: getCommandCatalog(client, config) });
          return;
        }

        res.json({ config });
      })
    );

    router.post(
      `/guilds/:guildId/${routeName}`,
      requireSession,
      loadUserGuilds,
      requireGuildAccess,
      asyncHandler(async (req, res) => {
        const payload = parseModulePayload(moduleName, req.body);
        const result = await saveModuleConfig(moduleName, req.params.guildId, payload, req.dashboardSession.user);
        botBridge.applyConfig(moduleName, req.params.guildId, result.newValue, req.dashboardSession.user);

        if (moduleName === "verification" && result.newValue.enabled) {
          const message = await botBridge.publishVerificationPanel(req.params.guildId);
          if (message?.id && message.id !== result.newValue.messageId) {
            result.newValue.messageId = message.id;
            await VerificationConfig.updateOne(
              { guildId: req.params.guildId },
              { messageId: message.id, updatedAt: new Date() }
            );
            botBridge.applyConfig(moduleName, req.params.guildId, result.newValue, req.dashboardSession.user);
          }
        }

        io.to(`guild:${req.params.guildId}`).emit(`dashboard:update${moduleName[0].toUpperCase()}${moduleName.slice(1)}`, {
          guildId: req.params.guildId,
          config: result.newValue
        });

        res.json({ ok: true, message: "Configuracao salva com sucesso", config: result.newValue });
      })
    );
  }

  router.post(
    "/guilds/:guildId/twitch/test",
    requireSession,
    loadUserGuilds,
    requireGuildAccess,
    asyncHandler(async (req, res) => {
      const message = await botBridge.sendTestAlert(req.params.guildId, req.dashboardSession.user);
      await createAuditLog({
        guildId: req.params.guildId,
        user: req.dashboardSession.user,
        action: "Usuario testou alerta de live",
        module: "twitch",
        newValue: { messageId: message.id, channelId: message.channelId }
      });
      res.json({ ok: true, message: "Alerta de teste enviado com sucesso" });
    })
  );

  router.post(
    "/guilds/:guildId/notices",
    requireSession,
    loadUserGuilds,
    requireGuildAccess,
    asyncHandler(async (req, res) => {
      const notice = noticeSchema.parse(req.body);
      const message = await botBridge.sendNotice(req.params.guildId, notice, req.dashboardSession.user);
      await createAuditLog({
        guildId: req.params.guildId,
        user: req.dashboardSession.user,
        action: "Usuario enviou aviso pelo painel",
        module: "notices",
        newValue: { ...notice, messageId: message.id, channelId: message.channelId }
      });
      res.json({ ok: true, message: "Aviso enviado com sucesso", messageId: message.id });
    })
  );

  router.post(
    "/guilds/:guildId/verification/publish",
    requireSession,
    loadUserGuilds,
    requireGuildAccess,
    asyncHandler(async (req, res) => {
      const message = await botBridge.publishVerificationPanel(req.params.guildId);
      res.json({ ok: true, message: "Painel de verificacao publicado", messageId: message?.id || null });
    })
  );

  router.get(
    "/guilds/:guildId/diagnostic",
    requireSession,
    loadUserGuilds,
    requireGuildAccess,
    asyncHandler(async (req, res) => {
      const guild = await getGuildDashboardData(client, req.params.guildId);
      const status = getBotStatus(client, botBridge.startedAt, io.engine.clientsCount);

      res.json({
        status,
        guild,
        diagnostic: {
          bot: status.status,
          botPing: status.ping,
          apiPing: 0,
          mongo: status.mongo,
          websocket: status.websocket,
          lastConnection: new Date().toISOString(),
          lastError: null,
          version: status.version,
          activeEvents: client.eventNames().length
        }
      });
    })
  );

  app.use("/api", router);

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Dados invalidos no formulario.",
        issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
      });
      return;
    }

    res.status(500).json({ error: error.message || "Erro interno da API." });
  });
}

module.exports = {
  setupDashboardApi
};
