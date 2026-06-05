const { io } = require("socket.io-client");
const logger = require("../../utils/logger");
const { handlers, logToConfiguredChannel } = require("../discord/dashboardActions");
const { emitGuildStats } = require("../discord/dashboardSync");

function startDashboardSocket(client) {
  const localPort = process.env.PORT || process.env.API_PORT || (process.env.NODE_ENV === "production" ? "80" : "4000");
  const url = process.env.BACKEND_SOCKET_URL || process.env.API_URL || `http://localhost:${localPort}`;
  const secret = process.env.BOT_SOCKET_SECRET || process.env.INTERNAL_WEBHOOK_SECRET || "dev-internal-secret";
  const socket = io(url, {
    auth: { role: "bot", secret },
    reconnection: true,
    reconnectionDelayMax: 8000,
    transports: ["websocket", "polling"]
  });

  socket.on("connect", () => {
    logger.info(`Dashboard socket conectado (${socket.id}).`);
    socket.emit("bot:statusUpdate", { online: true, at: new Date().toISOString() });

    for (const guild of client.guilds.cache.values()) {
      emitGuildStats(guild).catch((error) => {
        logger.warn(`Nao foi possivel emitir estatisticas para o dashboard: ${error.message}`);
      });
    }
  });

  socket.on("disconnect", (reason) => {
    logger.warn(`Dashboard socket desconectado: ${reason}`);
  });

  socket.on("connect_error", (error) => {
    logger.error("Erro no dashboard socket", error);
  });

  for (const [eventName, handler] of Object.entries(handlers)) {
    socket.on(eventName, async (event) => {
      try {
        const message = await handler(client, event);
        socket.emit("bot:success", {
          actionId: event.actionId,
          guildId: event.guildId,
          action: eventName,
          message
        });
        await logToConfiguredChannel(client, event.guildId, `✅ Dashboard: ${message}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro desconhecido.";
        socket.emit("bot:error", {
          actionId: event.actionId,
          guildId: event.guildId,
          action: eventName,
          error: message
        });
        await logToConfiguredChannel(client, event.guildId, `❌ Dashboard: ${message}`);
      }
    });
  }

  socket.on("dashboard:socialNotificationChanged", (event) => {
    logger.info(`Config social atualizada em tempo real: ${event?.guildId}/${event?.config?.platform}.`);
    socket.emit("bot:statusUpdate", {
      online: true,
      lastConfigEvent: "socialNotificationChanged",
      guildId: event?.guildId,
      at: new Date().toISOString()
    });
  });

  socket.on("dashboard:twitchChannelChanged", (event) => {
    logger.info(`Canal Twitch sincronizado em tempo real: ${event?.guildId}/${event?.action}.`);
    socket.emit("bot:statusUpdate", {
      online: true,
      lastConfigEvent: "twitchChannelChanged",
      guildId: event?.guildId,
      at: new Date().toISOString()
    });
  });

  socket.on("dashboard:twitchSubConfigChanged", (event) => {
    logger.info(`Config Twitch Subscriber sincronizada em tempo real: ${event?.guildId}.`);
    socket.emit("bot:statusUpdate", {
      online: true,
      lastConfigEvent: "twitchSubConfigChanged",
      guildId: event?.guildId,
      at: new Date().toISOString()
    });
  });

  return socket;
}

module.exports = {
  startDashboardSocket
};
