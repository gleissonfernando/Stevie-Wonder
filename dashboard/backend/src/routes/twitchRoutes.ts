import { Router } from "express";
import { requireAuth } from "../auth";
import { extractTwitchLogin, getTwitchUserByLogin } from "../services/twitch";

export const twitchRoutes = Router();

twitchRoutes.use(requireAuth);

twitchRoutes.get("/channel", async (request, response, next) => {
  try {
    const url = String(request.query.url || "");
    const login = extractTwitchLogin(url);

    if (!login) {
      response.status(400).json({ error: "Link da Twitch invalido." });
      return;
    }

    const channel = await getTwitchUserByLogin(login);
    response.json({ channel: channel.data[0] || null });
  } catch (error) {
    next(error);
  }
});
