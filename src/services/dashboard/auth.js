const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { User, Session } = require("../../models/dashboard");

const DISCORD_API = "https://discord.com/api/v10";
const SESSION_COOKIE = "ricardinn98_session";
const STATE_COOKIE = "ricardinn98_oauth_state";
const DEFAULT_SITE_URL = "https://steviewonder.shardweb.app";
const DEFAULT_REDIRECT_URI = "https://steviewonder.shardweb.app/api/auth/discord/callback";

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
}

function getRedirectUri() {
  return process.env.DISCORD_REDIRECT_URI || `${getSiteUrl()}/api/auth/discord/callback` || DEFAULT_REDIRECT_URI;
}

function getClientId() {
  return process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID || "";
}

function getClientSecret() {
  return process.env.DISCORD_CLIENT_SECRET || "";
}

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.SESSION_SECRET || "dev-only-change-this-secret";
}

function getCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeMs
  };
}

function buildDiscordOAuthUrl(state) {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("DISCORD_CLIENT_ID ou CLIENT_ID nao configurado.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "identify email guilds",
    state,
    prompt: "none"
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function exchangeDiscordCode(code) {
  const clientId = getClientId();
  const clientSecret = getClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("Configure DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri()
  });

  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha no OAuth Discord: ${response.status} ${detail}`);
  }

  return response.json();
}

async function discordRequest(accessToken, path) {
  const response = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Discord API respondeu ${response.status}: ${detail}`);
  }

  return response.json();
}

function getAvatarUrl(user) {
  if (!user.avatar) return "";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

async function fetchDiscordUser(accessToken) {
  return discordRequest(accessToken, "/users/@me");
}

async function fetchDiscordGuilds(accessToken) {
  return discordRequest(accessToken, "/users/@me/guilds");
}

async function upsertDashboardUser(user, guilds) {
  await User.findOneAndUpdate(
    { discordId: user.id },
    {
      discordId: user.id,
      username: user.username,
      globalName: user.global_name || "",
      avatar: getAvatarUrl(user),
      email: user.email || "",
      guilds,
      lastLoginAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function createSignedSession({ user, accessToken, refreshToken, expiresIn }) {
  const tokenId = crypto.randomUUID();
  const maxAgeSeconds = Math.min(Number(expiresIn || 604800), 604800);
  const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

  await Session.create({
    userId: user.id,
    tokenId,
    expiresAt
  }).catch(() => null);

  return {
    maxAgeMs: maxAgeSeconds * 1000,
    token: jwt.sign(
      {
        tokenId,
        user: {
          id: user.id,
          username: user.username,
          globalName: user.global_name || "",
          avatar: getAvatarUrl(user),
          email: user.email || ""
        },
        accessToken,
        refreshToken,
        expiresAt: expiresAt.toISOString()
      },
      getJwtSecret(),
      { expiresIn: maxAgeSeconds }
    )
  };
}

async function verifySessionToken(token) {
  if (!token) return null;

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const stored = await Session.findOne({ tokenId: payload.tokenId, revokedAt: null }).lean().catch(() => null);
    if (!stored && (process.env.MONGO_URI || process.env.MONGODB_URI)) return null;
    return payload;
  } catch {
    return null;
  }
}

function setSessionCookie(res, token, maxAgeMs) {
  res.cookie(SESSION_COOKIE, token, getCookieOptions(maxAgeMs));
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

function createOAuthState(res) {
  const state = crypto.randomBytes(24).toString("hex");
  res.cookie(STATE_COOKIE, state, getCookieOptions(10 * 60 * 1000));
  return state;
}

function verifyOAuthState(req, res, state) {
  const stored = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { path: "/" });
  const received = String(state || "");
  if (!stored || stored.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(received));
}

async function requireSession(req, res, next) {
  const payload = await verifySessionToken(req.cookies?.[SESSION_COOKIE]);
  if (!payload) {
    res.status(401).json({ error: "Sessao expirada. Entre com Discord novamente." });
    return;
  }

  req.dashboardSession = payload;
  next();
}

module.exports = {
  SESSION_COOKIE,
  buildDiscordOAuthUrl,
  clearSessionCookie,
  createOAuthState,
  createSignedSession,
  exchangeDiscordCode,
  fetchDiscordGuilds,
  fetchDiscordUser,
  getRedirectUri,
  requireSession,
  setSessionCookie,
  upsertDashboardUser,
  verifyOAuthState,
  verifySessionToken
};
