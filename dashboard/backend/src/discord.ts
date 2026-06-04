import { env } from "./env";

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

export type DiscordUserGuild = {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
  permissions?: string;
};

export function discordAvatarUrl(user: DiscordUser) {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

export function oauthUrl(redirectUri = env.redirectUri) {
  if (!env.clientId) {
    throw new Error("discord_client_id_missing");
  }

  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: env.discordOauthScopes
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string, redirectUri = env.redirectUri) {
  if (!env.clientId) {
    throw new Error("discord_client_id_missing");
  }

  if (!env.clientSecret || env.clientSecret.startsWith("coloque_")) {
    throw new Error("discord_client_secret_missing");
  }

  const body = new URLSearchParams({
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri
  });

  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`Falha ao autenticar com Discord. Status ${response.status}.`);
  }

  return response.json() as Promise<{ access_token: string }>;
}

export async function fetchDiscordUser(accessToken: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error("Falha ao buscar usuario Discord.");
  }

  return response.json() as Promise<DiscordUser>;
}

export async function fetchDiscordUserGuilds(accessToken: string) {
  const response = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error("Falha ao buscar servidores do Discord.");
  }

  return response.json() as Promise<DiscordUserGuild[]>;
}

export function discordGuildIconUrl(guild: DiscordUserGuild) {
  if (!guild.icon) return null;
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`;
}

export async function isAuthorizedGuildMember(userId: string) {
  if (env.authorizedUserIds.includes(userId)) return true;
  if (!env.requireGuildMember) return true;
  if (!env.guildId || !env.discordToken) return true;

  const response = await fetch(`https://discord.com/api/v10/guilds/${env.guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${env.discordToken}` }
  });

  if (!response.ok) {
    console.warn(`Falha ao verificar membro no servidor. Status ${response.status}.`);
  }

  return response.ok;
}
