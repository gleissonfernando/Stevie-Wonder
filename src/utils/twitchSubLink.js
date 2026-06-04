const jwt = require("jsonwebtoken");

function buildTwitchSubLink(member) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "http://localhost:4000").replace(/\/+$/, "");
  const secret = process.env.JWT_SECRET || "dev-secret";
  const state = jwt.sign(
    {
      type: "viewer",
      guildId: member.guild.id,
      discordId: member.id
    },
    secret,
    { expiresIn: "30m" }
  );

  return `${siteUrl}/api/twitch-subs/connect?state=${encodeURIComponent(state)}`;
}

module.exports = {
  buildTwitchSubLink
};
