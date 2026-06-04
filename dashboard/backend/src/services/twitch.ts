import { env } from "../env";

type TwitchToken = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string[];
};

type CachedToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

function assertTwitchConfig() {
  if (!env.twitchClientId || !env.twitchClientSecret) {
    throw new Error("TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET precisam estar configurados.");
  }

  if (env.twitchClientId === env.twitchClientSecret) {
    throw new Error("TWITCH_CLIENT_SECRET invalido. Gere um Client Secret real no Twitch Developer Console.");
  }
}

async function readTwitchError(response: Response) {
  const text = await response.text().catch(() => "");

  try {
    const data = JSON.parse(text) as { message?: string; error?: string; status?: number };
    return data.message || data.error || text;
  } catch {
    return text;
  }
}

export function extractTwitchLogin(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes("twitch.tv")) return null;
    const login = parsed.pathname.split("/").filter(Boolean)[0];
    return login || null;
  } catch {
    return null;
  }
}

export async function getTwitchAppAccessToken() {
  assertTwitchConfig();

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const params = new URLSearchParams({
    client_id: env.twitchClientId,
    client_secret: env.twitchClientSecret,
    grant_type: "client_credentials"
  });

  const response = await fetch(env.twitchTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  if (!response.ok) {
    const detail = await readTwitchError(response);
    throw new Error(`Falha ao autenticar com a Twitch Helix API. Status ${response.status}: ${detail}`);
  }

  const token = (await response.json()) as TwitchToken;
  cachedToken = {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000
  };

  return cachedToken.accessToken;
}

export async function twitchHelix<T>(path: string, searchParams?: Record<string, string>) {
  const accessToken = await getTwitchAppAccessToken();
  const url = new URL(`${env.twitchHelixUrl}${path}`);

  for (const [key, value] of Object.entries(searchParams || {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": env.twitchClientId
    }
  });

  if (!response.ok) {
    const detail = await readTwitchError(response);
    throw new Error(`Falha ao consultar a Twitch Helix API. Status ${response.status}: ${detail}`);
  }

  return response.json() as Promise<T>;
}

export async function getTwitchUserByLogin(login: string) {
  return twitchHelix<{
    data: Array<{
      id: string;
      login: string;
      display_name: string;
      profile_image_url: string;
    }>;
  }>("/users", { login });
}

export async function getTwitchStreamByUserId(userId: string) {
  return twitchHelix<{
    data: Array<{
      id: string;
      user_id: string;
      user_login: string;
      user_name: string;
      game_name: string;
      title: string;
      thumbnail_url: string;
      started_at: string;
      viewer_count: number;
    }>;
  }>("/streams", { user_id: userId });
}

export function twitchOAuthUrl(options: { redirectUri: string; state: string; scopes: string[] }) {
  if (!env.twitchClientId) {
    throw new Error("TWITCH_CLIENT_ID precisa estar configurado.");
  }

  const params = new URLSearchParams({
    client_id: env.twitchClientId,
    redirect_uri: options.redirectUri,
    response_type: "code",
    scope: options.scopes.join(" "),
    state: options.state
  });

  return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
}

export async function exchangeTwitchCode(code: string, redirectUri: string) {
  assertTwitchConfig();

  const params = new URLSearchParams({
    client_id: env.twitchClientId,
    client_secret: env.twitchClientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri
  });

  const response = await fetch(env.twitchTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  if (!response.ok) {
    const detail = await readTwitchError(response);
    throw new Error(`Falha no OAuth da Twitch. Status ${response.status}: ${detail}`);
  }

  return response.json() as Promise<TwitchToken>;
}

export async function refreshTwitchUserToken(refreshToken: string) {
  assertTwitchConfig();

  const params = new URLSearchParams({
    client_id: env.twitchClientId,
    client_secret: env.twitchClientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  const response = await fetch(env.twitchTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  if (!response.ok) {
    const detail = await readTwitchError(response);
    throw new Error(`Falha ao renovar token da Twitch. Status ${response.status}: ${detail}`);
  }

  return response.json() as Promise<TwitchToken>;
}

export async function twitchHelixWithUserToken<T>(
  accessToken: string,
  path: string,
  searchParams?: Record<string, string>
) {
  if (!env.twitchClientId) {
    throw new Error("TWITCH_CLIENT_ID precisa estar configurado.");
  }

  const url = new URL(`${env.twitchHelixUrl}${path}`);

  for (const [key, value] of Object.entries(searchParams || {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": env.twitchClientId
    }
  });

  if (!response.ok) {
    const detail = await readTwitchError(response);
    throw new Error(`Falha ao consultar Twitch com token de usuario. Status ${response.status}: ${detail}`);
  }

  return response.json() as Promise<T>;
}

export async function getTwitchUserByAccessToken(accessToken: string) {
  return twitchHelixWithUserToken<{
    data: Array<{
      id: string;
      login: string;
      display_name: string;
      profile_image_url: string;
    }>;
  }>(accessToken, "/users");
}

export async function getBroadcasterSubscription(
  accessToken: string,
  broadcasterId: string,
  userId: string
) {
  return twitchHelixWithUserToken<{
    data: Array<{
      broadcaster_id: string;
      broadcaster_login: string;
      broadcaster_name: string;
      gifter_id: string;
      gifter_login: string;
      gifter_name: string;
      is_gift: boolean;
      tier: string;
      plan_name: string;
      user_id: string;
      user_name: string;
      user_login: string;
    }>;
    total?: number;
  }>(accessToken, "/subscriptions", {
    broadcaster_id: broadcasterId,
    user_id: userId
  });
}
