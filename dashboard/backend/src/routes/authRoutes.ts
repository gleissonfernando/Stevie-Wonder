import { Router } from "express";
import type { Request } from "express";
import { discordAvatarUrl, exchangeCode, fetchDiscordUser, oauthUrl } from "../discord";
import { env } from "../env";
import { requireAuth, signSession } from "../auth";

export const authRoutes = Router();

function publicBaseUrl(request: Request) {
  const configuredSiteUrl = env.siteUrl.replace(/\/+$/, "");

  const forwardedProto = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(request.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const protocol = forwardedProto || request.protocol;
  const host = forwardedHost || request.get("host");

  if (host && !host.includes("localhost")) {
    return `https://${host}`.replace(/\/+$/, "");
  }

  if (configuredSiteUrl && !configuredSiteUrl.includes("localhost")) {
    return configuredSiteUrl;
  }

  if (!host) return configuredSiteUrl;

  return `${protocol}://${host}`.replace(/\/+$/, "");
}

function discordRedirectUri(request: Request) {
  const configuredRedirectUri = process.env.DISCORD_REDIRECT_URI || "";

  if (configuredRedirectUri && !configuredRedirectUri.includes("localhost")) {
    return configuredRedirectUri;
  }

  return `${publicBaseUrl(request)}/api/auth/discord/callback`;
}

function sessionCookieBaseOptions(request: Request) {
  const host = request.get("host") || "";
  const isLocalhost = host.includes("localhost");
  const secure =
    request.secure ||
    request.headers["x-forwarded-proto"] === "https" ||
    !isLocalhost;

  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure
  };
}

function sessionCookieOptions(request: Request) {
  return {
    ...sessionCookieBaseOptions(request),
    maxAge: 1000 * 60 * 60 * 24 * 7
  };
}

authRoutes.get("/discord", (request, response) => {
  try {
    response.redirect(oauthUrl(discordRedirectUri(request)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord_auth_failed";
    const code = message === "discord_client_id_missing" ? message : "discord_auth_failed";
    response.redirect(`${publicBaseUrl(request)}/?error=${code}`);
  }
});

authRoutes.get("/me", requireAuth, (request, response) => {
  const { accessToken: _accessToken, ...user } = request.user!;
  response.json({ user });
});

authRoutes.get("/discord/callback", async (request, response, next) => {
  try {
    const code = String(request.query.code || "");
    if (!code) {
      response.redirect(`${publicBaseUrl(request)}/?error=missing_code`);
      return;
    }

    const token = await exchangeCode(code, discordRedirectUri(request));
    const discordUser = await fetchDiscordUser(token.access_token);

    const user = {
      id: discordUser.id,
      username: discordUser.global_name || discordUser.username,
      avatar: discordAvatarUrl(discordUser),
      accessToken: token.access_token
    };

    const session = signSession(user);
    response.cookie(env.cookieName, session, sessionCookieOptions(request));
    response.redirect(`${publicBaseUrl(request)}/dashboard#session=${encodeURIComponent(session)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord_auth_failed";
    const code =
      message === "discord_client_id_missing" || message === "discord_client_secret_missing"
        ? message
        : "discord_auth_failed";
    response.redirect(`${publicBaseUrl(request)}/?error=${code}`);
  }
});

authRoutes.post("/logout", (request, response) => {
  response.clearCookie(env.cookieName, sessionCookieBaseOptions(request));
  response.json({ ok: true });
});

authRoutes.get("/logout", (request, response) => {
  response.clearCookie(env.cookieName, sessionCookieBaseOptions(request));
  response.redirect(publicBaseUrl(request));
});
