import { env } from "../env";

type TwitchToken = {
  access_token: string;
  expires_in: number;
  token_type: string;
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
