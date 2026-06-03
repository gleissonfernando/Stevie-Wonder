import type { Server as HttpServer } from "http";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import { randomUUID } from "crypto";
import { env } from "../env";
import type { AuthUser } from "../auth";
import { connectMongo } from "../services/mongo";
import { assertCanManageLives, validateDiscordAlertChannel } from "../services/discordGuild";
import { DashboardActionLog, DashboardConfig } from "../models/dashboardRealtime";
import { realtimeSchemas, type SiteActionName } from "../validators/realtimeValidators";

const siteEvents = Object.keys(realtimeSchemas) as SiteActionName[];
const pendingActions = new Map<string, { userId: string; guildId: string; action: string }>();

function parseUserFromSocket(socket: Socket) {
  const cookies = cookie.parse(socket.handshake.headers.cookie || "");
  const token = cookies[env.cookieName];
  if (!token) return null;
  return jwt.verify(token, env.jwtSecret) as AuthUser;
}

async function persistAction(action: SiteActionName, payload: any, user: AuthUser) {
  await connectMongo();
  const actionId = randomUUID();
  const guildId = payload.guildId || env.guildId;

  const config = await DashboardConfig.findOneAndUpdate(
    { guildId },
    { $setOnInsert: { guildId }, updatedBy: user.id },
    { upsert: true, new: true }
  );

  if (action === "site:setLogChannel") config.logChannelId = payload.channelId;
  if (action === "site:setWelcomeMessage") config.welcomeMessage = payload.message;
  if (action === "site:setAutoRole") config.autoRoleId = payload.roleId;
  if (action === "site:toggleSystem") config.set(`systems.${payload.system}`, payload.enabled);
  if (action === "site:updateConfig") config.set(`settings.${payload.key}`, payload.value);
  if (action === "site:createPanel" || action === "site:updatePanel") {
    config.set(`panels.${payload.messageId || actionId}`, payload);
  }

  await config.save();
  await DashboardActionLog.create({
    actionId,
    guildId,
    userId: user.id,
    username: user.username,
    action,
    payload,
    status: "queued"
  });

  return { actionId, guildId };
}

async function validateAction(action: SiteActionName, payload: any, user: AuthUser) {
  await assertCanManageLives(user.id, payload.guildId);

  if ("channelId" in payload) {
    await validateDiscordAlertChannel(payload.channelId, payload.guildId);
  }
}

async function markResult(event: "bot:success" | "bot:error", payload: any) {
  const pending = pendingActions.get(payload.actionId);
  if (!pending) return null;

  await connectMongo();
  await DashboardActionLog.updateOne(
    { actionId: payload.actionId },
    {
      status: event === "bot:success" ? "success" : "error",
      message: payload.message || payload.error || "",
      executedAt: new Date()
    }
  );

  if (event === "bot:success") pendingActions.delete(payload.actionId);
  return pending;
}

export function createDashboardSocket(server: HttpServer) {
  const io = new Server(server, {
    cors: { origin: env.siteUrl, credentials: true }
  });

  io.use((socket, next) => {
    if (socket.handshake.auth?.role === "bot") {
      if (socket.handshake.auth?.secret !== env.botSocketSecret) {
        next(new Error("Bot socket nao autorizado."));
        return;
      }
      socket.data.role = "bot";
      next();
      return;
    }

    try {
      const user = parseUserFromSocket(socket);
      if (!user) throw new Error("Sessao obrigatoria.");
      socket.data.role = "site";
      socket.data.user = user;
      next();
    } catch {
      next(new Error("Sessao invalida."));
    }
  });

  io.on("connection", (socket) => {
    if (socket.data.role === "bot") {
      socket.join("bots");
      io.emit("bot:statusUpdate", { online: true, at: new Date().toISOString() });

      socket.on("bot:success", async (payload) => {
        const pending = await markResult("bot:success", payload);
        if (pending) io.to(`user:${pending.userId}`).emit("bot:success", payload);
      });

      socket.on("bot:error", async (payload) => {
        const pending = await markResult("bot:error", payload);
        if (pending) io.to(`user:${pending.userId}`).emit("bot:error", payload);
      });

      socket.on("bot:statusUpdate", (payload) => {
        io.emit("bot:statusUpdate", { ...payload, online: true, at: new Date().toISOString() });
      });

      socket.on("disconnect", () => {
        io.emit("bot:statusUpdate", { online: false, at: new Date().toISOString() });
      });
      return;
    }

    const user = socket.data.user as AuthUser;
    socket.join(`user:${user.id}`);
    socket.emit("bot:statusUpdate", { online: io.sockets.adapter.rooms.get("bots")?.size ? true : false });

    for (const action of siteEvents) {
      socket.on(action, async (rawPayload, ack) => {
        try {
          const payload = realtimeSchemas[action].parse(rawPayload);
          await validateAction(action, payload, user);
          const { actionId, guildId } = await persistAction(action, payload, user);
          pendingActions.set(actionId, { userId: user.id, guildId, action });
          io.to("bots").emit(action, { actionId, guildId, user, payload });
          ack?.({ ok: true, actionId });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao executar acao.";
          ack?.({ ok: false, error: message });
          socket.emit("bot:error", { error: message });
        }
      });
    }
  });

  return io;
}
