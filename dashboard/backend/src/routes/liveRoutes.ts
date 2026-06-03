import { Router } from "express";
import { LiveStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";
import { liveRequestSchema } from "../liveSchema";
import { publishEvent } from "../realtime";
import { sendLiveRequestToDiscord } from "../services/liveDiscord";
import { extractTwitchLogin, getTwitchUserByLogin } from "../services/twitch";
import { env } from "../env";

export const liveRoutes = Router();

liveRoutes.use(requireAuth);

liveRoutes.get("/me", async (request, response) => {
  response.json({ user: request.user });
});

liveRoutes.get("/stats", async (request, response, next) => {
  try {
    const discordId = request.user!.id;
    const [total, pending, approved, rejected, latest] = await Promise.all([
      prisma.liveRequest.count({ where: { discordId } }),
      prisma.liveRequest.count({ where: { discordId, status: LiveStatus.PENDING } }),
      prisma.liveRequest.count({ where: { discordId, status: LiveStatus.APPROVED } }),
      prisma.liveRequest.count({ where: { discordId, status: LiveStatus.REJECTED } }),
      prisma.liveRequest.findMany({
        where: { discordId },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);

    response.json({ total, pending, approved, rejected, latest });
  } catch (error) {
    next(error);
  }
});

liveRoutes.get("/", async (request, response, next) => {
  try {
    const lives = await prisma.liveRequest.findMany({
      where: { discordId: request.user!.id },
      orderBy: { createdAt: "desc" }
    });

    response.json({ lives });
  } catch (error) {
    next(error);
  }
});

liveRoutes.post("/", async (request, response, next) => {
  try {
    const payload = liveRequestSchema.parse(request.body);
    const discordId = request.user!.id;
    const cooldownDate = new Date(Date.now() - env.liveCooldownSeconds * 1000);

    const recent = await prisma.liveRequest.findFirst({
      where: { discordId, createdAt: { gte: cooldownDate } },
      orderBy: { createdAt: "desc" }
    });

    if (recent) {
      response.status(429).json({ error: "Aguarde antes de solicitar outra live." });
      return;
    }

    if (payload.platform === "TWITCH") {
      const twitchLogin = extractTwitchLogin(payload.liveUrl);

      if (!twitchLogin) {
        response.status(400).json({ error: "Informe um link valido da Twitch." });
        return;
      }

      const twitchUser = await getTwitchUserByLogin(twitchLogin);

      if (!twitchUser.data.length) {
        response.status(400).json({ error: "Canal Twitch nao encontrado." });
        return;
      }
    }

    const live = await prisma.liveRequest.create({
      data: {
        discordId,
        discordUsername: request.user!.username,
        discordAvatar: request.user!.avatar,
        liveName: payload.liveName,
        platform: payload.platform,
        liveUrl: payload.liveUrl,
        startTime: payload.startTime,
        description: payload.description
      }
    });

    await sendLiveRequestToDiscord(live);
    publishEvent({ type: "live.created", payload: live, discordId });

    response.status(201).json({ live });
  } catch (error) {
    next(error);
  }
});

liveRoutes.get("/notifications", async (request, response, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { discordId: request.user!.id },
      orderBy: { createdAt: "desc" },
      take: 20
    });

    response.json({ notifications });
  } catch (error) {
    next(error);
  }
});

liveRoutes.patch("/notifications/:id/read", async (request, response, next) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: request.params.id },
      data: { read: true }
    });

    response.json({ notification });
  } catch (error) {
    next(error);
  }
});
