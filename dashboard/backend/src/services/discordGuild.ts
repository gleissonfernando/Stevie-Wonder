import { PermissionFlagsBits, REST, Routes } from "discord.js";
import { env } from "../env";

const rest = new REST({ version: "10" }).setToken(env.discordToken);

type Guild = {
  id: string;
  owner_id: string;
  name?: string;
  icon?: string | null;
};

type GuildMember = {
  user?: { id: string };
  permissions?: string;
  roles?: string[];
};

type DiscordChannel = {
  id: string;
  guild_id?: string;
  type: number;
  name?: string;
  parent_id?: string | null;
  position?: number;
  permission_overwrites?: PermissionOverwrite[];
};

type DiscordRole = {
  id: string;
  permissions?: string;
};

type PermissionOverwrite = {
  id: string;
  type: number;
  allow: string;
  deny: string;
};

export async function fetchGuild(guildId = env.guildId) {
  return rest.get(Routes.guild(guildId)) as Promise<Guild>;
}

export async function fetchGuildMember(userId: string, guildId = env.guildId) {
  return rest.get(Routes.guildMember(guildId, userId)) as Promise<GuildMember>;
}

export async function fetchGuildRoles(guildId = env.guildId) {
  return rest.get(Routes.guildRoles(guildId)) as Promise<DiscordRole[]>;
}

export async function listDiscordRoles(guildId = env.guildId) {
  const roles = await fetchGuildRoles(guildId);

  return roles
    .filter((role) => role.id !== guildId)
    .map((role) => ({
      id: role.id,
      name: (role as any).name || role.id,
      permissions: role.permissions || "0",
      color: (role as any).color || 0,
      position: (role as any).position || 0,
      managed: Boolean((role as any).managed)
    }))
    .sort((a, b) => b.position - a.position);
}

function applyOverwrite(permissions: bigint, overwrite?: PermissionOverwrite) {
  if (!overwrite) return permissions;

  const allow = BigInt(overwrite.allow || "0");
  const deny = BigInt(overwrite.deny || "0");

  return (permissions & ~deny) | allow;
}

async function resolveMemberChannelPermissions(channel: DiscordChannel, member: GuildMember, guildId = env.guildId) {
  const roles = await fetchGuildRoles(guildId);
  const rolePermissions = new Map(roles.map((role) => [role.id, BigInt(role.permissions || "0")]));

  let permissions = rolePermissions.get(guildId) || 0n;

  for (const roleId of member.roles || []) {
    permissions |= rolePermissions.get(roleId) || 0n;
  }

  if ((permissions & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator) {
    return PermissionFlagsBits.Administrator;
  }

  const overwrites = channel.permission_overwrites || [];
  permissions = applyOverwrite(permissions, overwrites.find((overwrite) => overwrite.id === guildId));

  let roleDeny = 0n;
  let roleAllow = 0n;

  for (const overwrite of overwrites) {
    if (overwrite.type !== 0 || !member.roles?.includes(overwrite.id)) continue;
    roleDeny |= BigInt(overwrite.deny || "0");
    roleAllow |= BigInt(overwrite.allow || "0");
  }

  permissions = (permissions & ~roleDeny) | roleAllow;
  permissions = applyOverwrite(permissions, overwrites.find((overwrite) => overwrite.type === 1 && overwrite.id === env.clientId));

  return permissions;
}

export async function assertCanManageLives(userId: string, guildId = env.guildId) {
  if (!guildId) throw new Error("GUILD_ID precisa estar configurado.");
  if (env.authorizedUserIds.includes(userId)) return true;

  const [guild, member] = await Promise.all([fetchGuild(guildId), fetchGuildMember(userId, guildId)]);
  const permissionBits = BigInt(member.permissions || "0");
  const isOwner = guild.owner_id === userId;
  const canManageGuild =
    (permissionBits & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator ||
    (permissionBits & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild;

  if (!isOwner && !canManageGuild) {
    throw new Error("Voce nao possui permissao para acessar as lives deste servidor.");
  }

  return true;
}

export function hasAdministratorPermission(permissions?: string, owner?: boolean) {
  if (owner) return true;
  const permissionBits = BigInt(permissions || "0");
  return (permissionBits & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator;
}

export function hasGuildManagementPermission(permissions?: string, owner?: boolean) {
  if (owner) return true;
  const permissionBits = BigInt(permissions || "0");
  return (
    (permissionBits & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator ||
    (permissionBits & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild
  );
}

export async function assertCanManageGuild(userId: string, guildId: string) {
  if (env.authorizedUserIds.includes(userId)) return true;

  const [guild, member] = await Promise.all([fetchGuild(guildId), fetchGuildMember(userId, guildId)]);
  const isOwner = guild.owner_id === userId;

  if (!hasGuildManagementPermission(member.permissions, isOwner)) {
    throw new Error("Voce precisa ter Administrator ou Manage Guild neste servidor para configurar alertas.");
  }

  return true;
}

export async function validateDiscordAlertChannel(channelId: string, guildId = env.guildId, mentionRoleId?: string) {
  const channel = (await rest.get(Routes.channel(channelId))) as DiscordChannel;

  if (channel.guild_id !== guildId) {
    throw new Error("O canal informado nao pertence ao servidor configurado.");
  }

  if (![0, 5, 15].includes(channel.type)) {
    throw new Error("Informe um canal de texto valido.");
  }

  if (mentionRoleId) {
    const role = (await rest.get(Routes.guildRole(guildId, mentionRoleId))) as DiscordRole;
    if (!role?.id) {
      throw new Error("O cargo configurado para mencao nao existe neste servidor.");
    }
  }

  return channel;
}

export async function resolveLiveAlertChannel(guildId = env.guildId) {
  const channels = (await rest.get(Routes.guildChannels(guildId))) as DiscordChannel[];
  const textChannels = channels.filter((channel) => [0, 5, 15].includes(channel.type));
  const byId = textChannels.find((channel) => channel.id === env.liveAlertChannelId);
  const byName = textChannels.find((channel) => channel.name === env.liveAlertChannelName);
  const channel = byId || byName;

  if (!channel) {
    throw new Error(`Canal de lives nao encontrado: ${env.liveAlertChannelName}. Rode /ativar ou configure LIVE_ALERT_CHANNEL_ID.`);
  }

  return {
    id: channel.id,
    name: channel.name || channel.id,
    type: channel.type,
    parentId: channel.parent_id || null
  };
}

export async function listDiscordAlertChannels(guildId = env.guildId) {
  const channels = (await rest.get(Routes.guildChannels(guildId))) as DiscordChannel[];

  return channels
    .filter((channel) => [0, 5, 15].includes(channel.type))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((channel) => ({
      id: channel.id,
      name: channel.name || channel.id,
      type: channel.type,
      parentId: channel.parent_id || null
    }));
}

export async function sendDiscordChannelMessage(channelId: string, body: unknown) {
  return rest.post(Routes.channelMessages(channelId), { body });
}

export async function addDiscordMemberRole(guildId: string, userId: string, roleId: string, reason: string) {
  return rest.put(Routes.guildMemberRole(guildId, userId, roleId), { reason });
}

export async function removeDiscordMemberRole(guildId: string, userId: string, roleId: string, reason: string) {
  return rest.delete(Routes.guildMemberRole(guildId, userId, roleId), { reason });
}

export async function fetchDiscordChannelMessage(channelId: string, messageId: string) {
  return rest.get(Routes.channelMessage(channelId, messageId));
}

export async function editDiscordChannelMessage(channelId: string, messageId: string, body: unknown) {
  return rest.patch(Routes.channelMessage(channelId, messageId), { body });
}
