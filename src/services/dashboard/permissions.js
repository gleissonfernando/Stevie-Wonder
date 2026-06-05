const { GuildConfig } = require("../../models/dashboard");

const ADMINISTRATOR = 0x8n;

function hasAdministratorPermission(userGuild) {
  try {
    return (BigInt(userGuild.permissions || "0") & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}

function getEnvAdminRoles() {
  return (process.env.PANEL_ADMIN_ROLE_IDS || "")
    .split(",")
    .map((roleId) => roleId.trim())
    .filter(Boolean);
}

async function getDashboardAdminRoles(guildId) {
  const config = await GuildConfig.findOne({ guildId }).lean().catch(() => null);
  return [...new Set([...(config?.adminRoles || []), ...getEnvAdminRoles()])];
}

async function userHasPanelRole(client, guildId, userId) {
  const adminRoles = await getDashboardAdminRoles(guildId);
  if (!adminRoles.length) return false;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return false;

  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;

  return adminRoles.some((roleId) => member.roles.cache.has(roleId));
}

async function canManageGuild(client, userGuild, userId) {
  if (!userGuild) return false;
  if (!client.guilds.cache.has(userGuild.id)) return false;
  if (userGuild.owner) return true;
  if (hasAdministratorPermission(userGuild)) return true;
  return userHasPanelRole(client, userGuild.id, userId);
}

async function filterManageableGuilds(client, userGuilds, userId) {
  const allowed = [];

  for (const userGuild of userGuilds || []) {
    if (await canManageGuild(client, userGuild, userId)) {
      const botGuild = client.guilds.cache.get(userGuild.id);
      allowed.push({
        id: userGuild.id,
        name: botGuild?.name || userGuild.name,
        icon: userGuild.icon || botGuild?.icon || "",
        owner: Boolean(userGuild.owner),
        permissions: userGuild.permissions || "0",
        memberCount: botGuild?.memberCount || 0,
        botPresent: Boolean(botGuild)
      });
    }
  }

  return allowed;
}

async function requireGuildAccess(req, res, next) {
  const guildId = req.params.guildId;
  const session = req.dashboardSession;
  const userGuilds = req.dashboardUserGuilds || [];
  const userGuild = userGuilds.find((guild) => guild.id === guildId);

  if (!(await canManageGuild(req.dashboardClient, userGuild, session.user.id))) {
    res.status(403).json({ error: "Voce nao tem permissao para gerenciar este servidor." });
    return;
  }

  req.dashboardGuild = userGuild;
  next();
}

module.exports = {
  canManageGuild,
  filterManageableGuilds,
  getDashboardAdminRoles,
  hasAdministratorPermission,
  requireGuildAccess
};
