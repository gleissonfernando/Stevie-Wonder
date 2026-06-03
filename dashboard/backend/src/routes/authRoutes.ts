import { Router } from "express";
import { discordAvatarUrl, exchangeCode, fetchDiscordUser, isAuthorizedGuildMember, oauthUrl } from "../discord";
import { env } from "../env";
import { requireAuth, signSession } from "../auth";

export const authRoutes = Router();

authRoutes.get("/discord", (_request, response) => {
  response.redirect(oauthUrl());
});

authRoutes.get("/me", requireAuth, (request, response) => {
  response.json({ user: request.user });
});

authRoutes.get("/discord/callback", async (request, response, next) => {
  try {
    const code = String(request.query.code || "");
    if (!code) {
      response.redirect(`${env.siteUrl}/?error=missing_code`);
      return;
    }

    const token = await exchangeCode(code);
    const discordUser = await fetchDiscordUser(token.access_token);
    const authorized = await isAuthorizedGuildMember(discordUser.id);

    if (!authorized) {
      response.redirect(`${env.siteUrl}/?error=unauthorized_guild_member`);
      return;
    }

    const user = {
      id: discordUser.id,
      username: discordUser.global_name || discordUser.username,
      avatar: discordAvatarUrl(discordUser)
    };

    response.cookie(env.cookieName, signSession(user), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    response.redirect(`${env.siteUrl}/dashboard`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord_auth_failed";
    const code = message === "discord_client_secret_missing" ? message : "discord_auth_failed";
    response.redirect(`${env.siteUrl}/?error=${code}`);
  }
});

authRoutes.post("/logout", (_request, response) => {
  response.clearCookie(env.cookieName);
  response.json({ ok: true });
});

authRoutes.get("/logout", (_request, response) => {
  response.clearCookie(env.cookieName);
  response.redirect(env.siteUrl);
});
