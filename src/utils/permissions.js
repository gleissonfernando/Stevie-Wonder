const { PermissionFlagsBits } = require("discord.js");

function hasPermission(member, permission) {
  if (!permission) return true;
  return member.permissions.has(PermissionFlagsBits[permission]);
}

function hasAnyPermission(member, permissions = []) {
  if (!permissions.length) return true;
  return permissions.some((permission) => hasPermission(member, permission));
}

module.exports = {
  hasPermission,
  hasAnyPermission
};
