import type { Response } from "express";

type RealtimeEvent = {
  type: string;
  payload: unknown;
  discordId?: string;
};

const clients = new Map<string, Set<Response>>();

export function addRealtimeClient(discordId: string, response: Response) {
  if (!clients.has(discordId)) {
    clients.set(discordId, new Set());
  }

  clients.get(discordId)?.add(response);
  response.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

  response.on("close", () => {
    clients.get(discordId)?.delete(response);
    if (!clients.get(discordId)?.size) {
      clients.delete(discordId);
    }
  });
}

export function publishEvent(event: RealtimeEvent) {
  const targets = event.discordId ? clients.get(event.discordId) : undefined;
  const payload = `data: ${JSON.stringify(event)}\n\n`;

  if (targets) {
    for (const response of targets) {
      response.write(payload);
    }
    return;
  }

  for (const group of clients.values()) {
    for (const response of group) {
      response.write(payload);
    }
  }
}
