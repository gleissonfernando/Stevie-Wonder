const logger = require("../../utils/logger");

function emitDashboardEvent(client, eventName, payload) {
  const socket = client?.dashboardSocket;

  if (!socket?.connected) return false;
  socket.emit(eventName, payload);
  return true;
}

async function collectGuildStats(guild) {
  let botCount = guild.members.cache.filter((member) => member.user.bot).size;

  try {
    const members = await guild.members.fetch();
    botCount = members.filter((member) => member.user.bot).size;
  } catch (error) {
    logger.warn(`Nao foi possivel buscar todos os membros de ${guild.id}: ${error.message}`);
  }

  return {
    guildId: guild.id,
    name: guild.name,
    icon: guild.iconURL({ size: 96 }),
    memberCount: guild.memberCount || guild.members.cache.size,
    onlineCount: guild.presences?.cache?.size || 0,
    botCount
  };
}

async function emitGuildStats(guild) {
  const stats = await collectGuildStats(guild);
  emitDashboardEvent(guild.client, "bot:guildStats", stats);
  return stats;
}

function emitDashboardLog(guild, payload) {
  emitDashboardEvent(guild.client, "bot:auditLog", {
    guildId: guild.id,
    type: payload.type || "discord",
    action: payload.action || "audit",
    message: payload.message || payload.title || "Evento do Discord.",
    userId: payload.userId || null,
    targetId: payload.targetId || null,
    counter: payload.counter || null,
    metadata: payload.metadata || null
  });
}

module.exports = {
  collectGuildStats,
  emitDashboardEvent,
  emitDashboardLog,
  emitGuildStats
};
