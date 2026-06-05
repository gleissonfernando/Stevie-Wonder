import { Router } from "express";
import type { Request } from "express";
import crypto from "crypto";
import {
  discordAvatarUrl,
  discordGuildIconUrl,
  exchangeCode,
  fetchDiscordUser,
  fetchDiscordUserGuilds,
  isAuthorizedGuildMember,
  oauthUrl
} from "../discord";
import { env } from "../env";
import { requireAuth, signSession } from "../auth";
import { connectMongo } from "../services/mongo";
import { DashboardUser } from "../models/dashboardRealtime";
import { hasGuildManagementPermission } from "../services/discordGuild";
import { encryptToken } from "../secureTokens";

export const authRoutes = Router();

const oauthStateCookieName = `${env.cookieName}_discord_oauth_state`;

function scopeList(value?: string) {
  return String(value || env.discordOauthScopes)
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function serializeDiscordGuild(guild: {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
}) {
  const canManage = hasGuildManagementPermission(guild.permissions, guild.owner);

  return {
    id: guild.id,
    name: guild.name,
    icon: discordGuildIconUrl(guild) || null,
    owner: Boolean(guild.owner),
    permissions: guild.permissions || "0",
    canManage
  };
}

function serializeCachedGuilds(guilds: any[] = []) {
  return guilds.map((guild) => ({
    id: String(guild.id),
    name: String(guild.name || guild.id),
    icon: guild.icon || null,
    owner: Boolean(guild.owner),
    canManage: Boolean(guild.canManage)
  }));
}

function serializeSessionUser(user: any, fallback: any = {}) {
  return {
    id: String(user?.discordId || fallback.id || ""),
    username: String(user?.username || fallback.username || "Discord User"),
    avatar: user?.avatar || fallback.avatar || null,
    email: user?.email || fallback.email || null,
    lastLoginAt: user?.lastLoginAt || fallback.lastLoginAt || null,
    authenticated: true,
    guilds: serializeCachedGuilds(user?.guilds || fallback.guilds || []).filter((guild) => guild.canManage)
  };
}

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
    const state = crypto.randomBytes(24).toString("base64url");
    response.cookie(oauthStateCookieName, state, {
      ...sessionCookieBaseOptions(request),
      maxAge: 1000 * 60 * 10
    });
    response.redirect(oauthUrl(discordRedirectUri(request), state));
  } catch (error) {
    const message = error instanceof Error ? error.message : "discord_auth_failed";
    const code = message === "discord_client_id_missing" ? message : "discord_auth_failed";
    response.redirect(`${publicBaseUrl(request)}/?error=${code}`);
  }
});

authRoutes.get("/me", requireAuth, async (request, response, next) => {
  try {
    await connectMongo();
    const dashboardUser = await DashboardUser.findOne({ discordId: request.user!.id }).lean();
    response.json({ user: serializeSessionUser(dashboardUser, request.user) });
  } catch (error) {
    console.warn("Falha ao carregar usuario do Mongo; usando sessao JWT.", error);
    response.json({ user: serializeSessionUser(null, request.user) });
  }
});

authRoutes.get("/discord/callback", async (request, response, next) => {
  try {
    const code = String(request.query.code || "");
    if (!code) {
      response.redirect(`${publicBaseUrl(request)}/?error=missing_code`);
      return;
    }

    const state = String(request.query.state || "");
    const expectedState = String(request.cookies?.[oauthStateCookieName] || "");
    response.clearCookie(oauthStateCookieName, sessionCookieBaseOptions(request));

    if (!state || !expectedState || state !== expectedState) {
      response.redirect(`${publicBaseUrl(request)}/?error=invalid_oauth_state`);
      return;
    }

    const token = await exchangeCode(code, discordRedirectUri(request));
    const discordUser = await fetchDiscordUser(token.access_token);
    const discordGuilds = await fetchDiscordUserGuilds(token.access_token).catch(() => null);

    if (!(await isAuthorizedGuildMember(discordUser.id))) {
      response.redirect(`${publicBaseUrl(request)}/?error=unauthorized_guild`);
      return;
    }

    const guilds = discordGuilds ? discordGuilds.map(serializeDiscordGuild) : null;
    const sessionGuilds = guilds
      ? serializeCachedGuilds(guilds).filter((guild) => guild.canManage)
      : [];
    const lastLoginAt = new Date();

    const user = {
      id: discordUser.id,
      username: discordUser.global_name || discordUser.username,
      avatar: discordAvatarUrl(discordUser),
      email: discordUser.email || null,
      lastLoginAt: lastLoginAt.toISOString(),
      guilds: sessionGuilds
    };

    const session = signSession(user);
    response.cookie(env.cookieName, session, sessionCookieOptions(request));

    try {
      await connectMongo();
      const expiresIn = Number(token.expires_in || 604800);
      const tokenUpdate: Record<string, unknown> = {
        discordAccessToken: encryptToken(token.access_token),
        discordTokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
        discordScopes: scopeList(token.scope),
        lastLoginAt
      };

      if (token.refresh_token) {
        tokenUpdate.discordRefreshToken = encryptToken(token.refresh_token);
      }

      const profileUpdate: Record<string, unknown> = {
        username: user.username,
        email: discordUser.email || null,
        avatar: user.avatar,
        ...tokenUpdate
      };

      if (guilds) {
        profileUpdate.guilds = guilds;
      }

      await DashboardUser.findOneAndUpdate(
        { discordId: discordUser.id },
        {
          $set: profileUpdate,
          $setOnInsert: {
            discordId: discordUser.id,
            firstLoginAt: lastLoginAt
          }
        },
        { upsert: true, new: true }
      );
    } catch (databaseError) {
      console.warn("Login Discord criado, mas nao foi possivel salvar usuario no Mongo.", databaseError);
    }

    response.redirect(`${publicBaseUrl(request)}/dashboard`);
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
  response.clearCookie(oauthStateCookieName, sessionCookieBaseOptions(request));
  response.json({ ok: true });
});

authRoutes.get("/logout", (request, response) => {
  response.clearCookie(env.cookieName, sessionCookieBaseOptions(request));
  response.clearCookie(oauthStateCookieName, sessionCookieBaseOptions(request));
  response.redirect(publicBaseUrl(request));
});
