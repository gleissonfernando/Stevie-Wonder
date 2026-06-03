import { Router } from "express";
import { requireAuth } from "../auth";
import { addRealtimeClient, publishEvent } from "../realtime";
import { env } from "../env";

export const realtimeRoutes = Router();

realtimeRoutes.get("/events", requireAuth, (request, response) => {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  addRealtimeClient(request.user!.id, response);
});

realtimeRoutes.post("/bot/live-events", (request, response) => {
  if (request.headers["x-internal-secret"] !== env.internalWebhookSecret) {
    response.status(401).json({ error: "Nao autorizado." });
    return;
  }

  publishEvent(request.body);
  response.json({ ok: true });
});
