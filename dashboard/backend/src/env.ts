import "dotenv/config";

const siteUrl = (process.env.SITE_URL || "http://localhost:3001").replace(/\/+$/, "");

export const env = {
  port: Number(process.env.PORT || process.env.API_PORT || (process.env.NODE_ENV === "production" ? 80 : 4000)),
  siteUrl,
  apiUrl: process.env.API_URL || "http://localhost:4000",
  discordToken: process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN || "",
  clientId: process.env.CLIENT_ID || "",
  clientSecret: process.env.DISCORD_CLIENT_SECRET || "",
  discordOauthScopes: process.env.DISCORD_OAUTH_SCOPES || "identify",
  redirectUri: process.env.DISCORD_REDIRECT_URI || `${siteUrl}/api/auth/discord/callback`,
  guildId: process.env.GUILD_ID || "",
  requireGuildMember: process.env.REQUIRE_GUILD_MEMBER === "true",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  cookieName: process.env.SESSION_COOKIE_NAME || "steve_session",
  internalWebhookSecret: process.env.INTERNAL_WEBHOOK_SECRET || "dev-internal-secret",
  liveAlertChannelId: process.env.LIVE_ALERT_CHANNEL_ID || "",
  liveAlertChannelName: process.env.LIVE_ALERT_CHANNEL_NAME || "canal-de-live",
  liveMentionRoleId: process.env.LIVE_MENTION_ROLE_ID || "",
  botSocketSecret: process.env.BOT_SOCKET_SECRET || process.env.INTERNAL_WEBHOOK_SECRET || "dev-internal-secret",
  liveCooldownSeconds: Number(process.env.LIVE_REQUEST_COOLDOWN_SECONDS || 300),
  liveCheckIntervalSeconds: Number(process.env.LIVE_CHECK_INTERVAL_SECONDS || 180),
  twitchClientId: process.env.TWITCH_CLIENT_ID || "",
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET || "",
  twitchRedirectUrl: process.env.TWITCH_REDIRECT_URL || "",
  twitchTokenUrl: process.env.TWITCH_TOKEN_URL || "https://id.twitch.tv/oauth2/token",
  twitchHelixUrl: process.env.TWITCH_HELIX_URL || "https://api.twitch.tv/helix",
  mongodbUri: process.env.MONGODB_URI || process.env.MONGO_URI || "",
  publicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:3001",
  authorizedUserIds: (process.env.AUTHORIZED_USER_IDS || process.env.OWNER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
};
