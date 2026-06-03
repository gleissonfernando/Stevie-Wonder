const { io } = require("socket.io-client");
const logger = require("../../utils/logger");
const { handlers, logToConfiguredChannel } = require("../discord/dashboardActions");

function startDashboardSocket(client) {
  const url = process.env.BACKEND_SOCKET_URL || process.env.API_URL || "http://localhost:4000";
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

  return socket;
}

module.exports = {
  startDashboardSocket
};
