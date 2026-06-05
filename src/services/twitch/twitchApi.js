const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2";
const TWITCH_API_URL = "https://api.twitch.tv/helix";
const EVENTSUB_TYPES = ["channel.subscribe", "channel.subscription.message", "channel.subscription.end"];

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.SESSION_SECRET || "dev-only-change-this-secret";
}

function getSiteUrl() {
  return (process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://steviewonder.shardweb.app").replace(/\/$/, "");
}

function getApiUrl() {
  return (process.env.API_URL || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || getSiteUrl()).replace(/\/$/, "");
}

function getTwitchRedirectUri() {
  return process.env.TWITCH_REDIRECT_URI || `${getSiteUrl()}/api/auth/twitch/callback`;
}

function getTwitchCredentials() {
  const clientId = process.env.TWITCH_CLIENT_ID || "";
  const clientSecret = process.env.TWITCH_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    throw new Error("Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET.");
  }

  return { clientId, clientSecret };
}

function getEventSubSecret() {
  const secret = process.env.TWITCH_EVENTSUB_SECRET || "";
  if (!secret) {
    throw new Error("Configure TWITCH_EVENTSUB_SECRET.");
  }

  return secret;
}

function createTwitchState({ mode, guildId, userId }) {
  return jwt.sign({ guildId: guildId || "", mode, type: "twitch_oauth", userId }, getJwtSecret(), { expiresIn: "10m" });
}

function verifyTwitchState(state) {
  const payload = jwt.verify(String(state || ""), getJwtSecret());
  if (payload.type !== "twitch_oauth") {
    throw new Error("Estado OAuth Twitch invalido.");
  }

  return payload;
}

function buildTwitchOAuthUrl(state, mode = "link") {
  const { clientId } = getTwitchCredentials();
  const scopes = mode === "broadcaster"
    ? ["user:read:email", "channel:read:subscriptions"]
    : ["user:read:email"];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getTwitchRedirectUri(),
    response_type: "code",
    scope: scopes.join(" "),
    state,
    force_verify: "true"
  });

  return `${TWITCH_AUTH_URL}/authorize?${params.toString()}`;
}

async function exchangeTwitchCode(code) {
  const { clientId, clientSecret } = getTwitchCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: getTwitchRedirectUri()
  });

  const response = await fetch(`${TWITCH_AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`Falha no OAuth Twitch: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function getAppAccessToken() {
  const { clientId, clientSecret } = getTwitchCredentials();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials"
  });

  const response = await fetch(`${TWITCH_AUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter app token Twitch: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function twitchApiRequest(path, accessToken) {
  const { clientId } = getTwitchCredentials();
  const response = await fetch(`${TWITCH_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": clientId
    }
  });

  if (!response.ok) {
    throw new Error(`Twitch API respondeu ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function fetchTwitchUser(accessToken) {
  const data = await twitchApiRequest("/users", accessToken);
  return data.data?.[0] || null;
}

async function createEventSubSubscription({ broadcasterUserId, type }) {
  const { clientId } = getTwitchCredentials();
  const appToken = await getAppAccessToken();
  const callback = `${getApiUrl()}/api/twitch/eventsub/webhook`;

  const response = await fetch(`${TWITCH_API_URL}/eventsub/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appToken.access_token}`,
      "Client-Id": clientId,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type,
      version: "1",
      condition: { broadcaster_user_id: broadcasterUserId },
      transport: {
        method: "webhook",
        callback,
        secret: getEventSubSecret()
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Falha ao criar EventSub ${type}: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.data?.[0] || null;
}

async function ensureEventSubSubscriptions(config) {
  if (!config.twitchBroadcasterId) {
    throw new Error("Conecte a Twitch do streamer antes de ativar o EventSub.");
  }

  const existingTypes = new Set((config.eventSubSubscriptions || []).map((item) => item.type));
  const created = [];

  for (const type of EVENTSUB_TYPES) {
    if (existingTypes.has(type)) continue;
    const subscription = await createEventSubSubscription({
      broadcasterUserId: config.twitchBroadcasterId,
      type
    });

    if (subscription) {
      created.push({
        type,
        id: subscription.id,
        status: subscription.status,
        createdAt: subscription.created_at ? new Date(subscription.created_at) : new Date()
      });
    }
  }

  return created;
}

function validateEventSubSignature(req) {
  const secret = getEventSubSecret();
  const messageId = req.get("Twitch-Eventsub-Message-Id");
  const timestamp = req.get("Twitch-Eventsub-Message-Timestamp");
  const signature = req.get("Twitch-Eventsub-Message-Signature");
  const rawBody = req.rawBody || JSON.stringify(req.body || {});

  if (!messageId || !timestamp || !signature) return false;

  const hmacMessage = messageId + timestamp + rawBody;
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(hmacMessage).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

module.exports = {
  EVENTSUB_TYPES,
  buildTwitchOAuthUrl,
  createTwitchState,
  ensureEventSubSubscriptions,
  exchangeTwitchCode,
  fetchTwitchUser,
  getApiUrl,
  getTwitchRedirectUri,
  validateEventSubSignature,
  verifyTwitchState
};
