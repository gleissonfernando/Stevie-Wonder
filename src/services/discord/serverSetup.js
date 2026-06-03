const { ChannelType, PermissionFlagsBits } = require("discord.js");
const { categoryDefinitions, roleDefinitions } = require("../../config/serverSetup");
const logger = require("../../utils/logger");

const tempVoiceOwners = new Map();
const restoreTimers = new Map();

function permissionsValue(permissions) {
  return permissions.reduce((bits, permission) => bits | permission, 0n);
}

function sameKind(channel, definition) {
  return channel?.type === definition.type;
}

function managedCategoryNames() {
  return new Set(categoryDefinitions.map((category) => category.name));
}

function managedChannelNames() {
  return new Set(categoryDefinitions.flatMap((category) => category.channels.map((channel) => channel.name)));
}

function roleNames() {
  return new Set(roleDefinitions.map((role) => role.name));
}

async function ensureRole(guild, definition) {
  const matches = guild.roles.cache
    .filter((role) => role.name === definition.name)
    .sort((a, b) => a.position - b.position);

  const role = matches.first() || await guild.roles.create({
    name: definition.name,
    color: definition.color,
    permissions: permissionsValue(definition.permissions),
    reason: "Sistema /ativar - cargo obrigatorio"
  });

  const desiredPermissions = permissionsValue(definition.permissions);

  if (role.color !== definition.color || role.permissions.bitfield !== desiredPermissions) {
    await role.edit({
      color: definition.color,
      permissions: desiredPermissions,
      reason: "Sistema /ativar - restaurando cargo"
    }).catch((error) => logger.warn(`Nao foi possivel editar o cargo ${definition.name}: ${error.message}`));
  }

  const duplicates = matches.filter((duplicate) => duplicate.id !== role.id);
  for (const duplicate of duplicates.values()) {
    await duplicate.delete("Sistema /ativar - cargo duplicado").catch(() => null);
  }

  return role;
}

async function ensureRoles(guild) {
  const roles = new Map();

  for (const definition of roleDefinitions) {
    const role = await ensureRole(guild, definition);
    roles.set(definition.name, role);
  }

  const orderedRoles = roleDefinitions
    .map((definition, index) => ({ role: roles.get(definition.name), position: roleDefinitions.length - index }))
    .filter((entry) => entry.role && entry.role.editable);

  for (const entry of orderedRoles) {
    await entry.role.setPosition(entry.position, { reason: "Sistema /ativar - hierarquia padrao" }).catch(() => null);
  }

  return roles;
}

function categoryOverwrites(guild, category, roles) {
  const overwrites = [];

  if (category.staffOnly) {
    overwrites.push({
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    });

    for (const roleName of ["👑 Fundador", "🛡️ Administrador", "⚔️ Moderador", "🎫 Suporte"]) {
      const role = roles.get(roleName);
      if (role) {
        overwrites.push({
          id: role.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }
    }
  }

  return overwrites;
}

function channelOverwrites(guild, channel, roles) {
  if (channel.vipOnly) {
    const vipRole = roles.get("💜 VIP");
    return [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel]
      },
      ...(vipRole
        ? [{
            id: vipRole.id,
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Speak]
          }]
        : [])
    ];
  }

  return undefined;
}

async function ensureCategory(guild, definition, roles) {
  const matches = guild.channels.cache
    .filter((channel) => channel.type === ChannelType.GuildCategory && channel.name === definition.name)
    .sort((a, b) => a.position - b.position);

  const category = matches.first() || await guild.channels.create({
    name: definition.name,
    type: ChannelType.GuildCategory,
    permissionOverwrites: categoryOverwrites(guild, definition, roles),
    reason: "Sistema /ativar - categoria obrigatoria"
  });

  const duplicates = matches.filter((duplicate) => duplicate.id !== category.id);
  for (const duplicate of duplicates.values()) {
    if (!duplicate.children.cache.size) {
      await duplicate.delete("Sistema /ativar - categoria duplicada vazia").catch(() => null);
    }
  }

  return category;
}

async function ensureChannel(guild, category, definition, roles) {
  const matches = guild.channels.cache
    .filter((channel) => channel.name === definition.name && sameKind(channel, definition))
    .sort((a, b) => a.position - b.position);

  const existingInCategory = matches.find((channel) => channel.parentId === category.id);
  const channel = existingInCategory || matches.first() || await guild.channels.create({
    name: definition.name,
    type: definition.type,
    parent: category.id,
    permissionOverwrites: channelOverwrites(guild, definition, roles),
    reason: "Sistema /ativar - canal obrigatorio"
  });

  const editPayload = {};
  if (channel.parentId !== category.id) editPayload.parent = category.id;

  if (Object.keys(editPayload).length) {
    await channel.edit({ ...editPayload, reason: "Sistema /ativar - organizando canal" }).catch(() => null);
  }

  const overwrites = channelOverwrites(guild, definition, roles);
  if (overwrites) {
    await channel.permissionOverwrites.set(overwrites, "Sistema /ativar - permissoes padrao").catch(() => null);
  }

  const duplicates = matches.filter((duplicate) => duplicate.id !== channel.id);
  for (const duplicate of duplicates.values()) {
    await duplicate.delete("Sistema /ativar - canal duplicado").catch(() => null);
  }

  return channel;
}

async function ensureServerStructure(guild, options = {}) {
  await guild.channels.fetch().catch(() => null);
  await guild.roles.fetch().catch(() => null);

  const roles = await ensureRoles(guild);
  let createdOrEnsuredChannels = 0;

  for (const categoryDefinition of categoryDefinitions) {
    const category = await ensureCategory(guild, categoryDefinition, roles);

    for (const channelDefinition of categoryDefinition.channels) {
      await ensureChannel(guild, category, channelDefinition, roles);
      createdOrEnsuredChannels += 1;
    }
  }

  if (options.cleanup) {
    await removeUnmanagedStructure(guild);
  }

  return {
    categories: categoryDefinitions.length,
    channels: createdOrEnsuredChannels,
    roles: roleDefinitions.length
  };
}

async function removeUnmanagedStructure(guild) {
  const categoryNames = managedCategoryNames();
  const channelNames = managedChannelNames();
  const requiredRoleNames = roleNames();

  const unmanagedChannels = guild.channels.cache
    .filter((channel) => {
      if (channel.type === ChannelType.GuildCategory) {
        return !categoryNames.has(channel.name);
      }

      return !channelNames.has(channel.name);
    })
    .sort((a, b) => {
      const aIsCategory = a.type === ChannelType.GuildCategory ? 1 : 0;
      const bIsCategory = b.type === ChannelType.GuildCategory ? 1 : 0;
      return aIsCategory - bIsCategory;
    });

  for (const channel of unmanagedChannels.values()) {
    await channel.delete("Sistema /ativar - removendo canal fora do modelo oficial").catch((error) => {
      logger.warn(`Nao foi possivel remover o canal ${channel.name}: ${error.message}`);
    });
  }

  for (const role of guild.roles.cache.values()) {
    if (!requiredRoleNames.has(role.name)) continue;
    const siblings = guild.roles.cache.filter((candidate) => candidate.name === role.name);
    if (siblings.size > 1 && role.editable) {
      const keeper = siblings.sort((a, b) => b.position - a.position).first();
      if (role.id !== keeper.id) {
        await role.delete("Sistema /ativar - duplicata de cargo gerenciado").catch(() => null);
      }
    }
  }
}

function scheduleStructureRestore(guild) {
  const currentTimer = restoreTimers.get(guild.id);
  if (currentTimer) clearTimeout(currentTimer);

  const timer = setTimeout(() => {
    ensureServerStructure(guild, { cleanup: true })
      .then(() => logger.info(`Estrutura obrigatoria restaurada em ${guild.name}.`))
      .catch((error) => logger.error("Falha ao restaurar estrutura obrigatoria", error))
      .finally(() => restoreTimers.delete(guild.id));
  }, 3000);

  restoreTimers.set(guild.id, timer);
}

function findTemporaryCreator(guild) {
  return guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildVoice && channel.name === "➕・criar-sala"
  );
}

async function handleTempVoice(oldState, newState) {
  if (newState.channelId && newState.channelId !== oldState.channelId) {
    const creator = findTemporaryCreator(newState.guild);

    if (creator && newState.channelId === creator.id) {
      const channel = await newState.guild.channels.create({
        name: `🔊・${newState.member.user.username}`,
        type: ChannelType.GuildVoice,
        parent: creator.parentId,
        permissionOverwrites: [
          {
            id: newState.member.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.MoveMembers,
              PermissionFlagsBits.ManageChannels
            ]
          }
        ],
        reason: "Sistema de call temporaria"
      });

      tempVoiceOwners.set(channel.id, newState.member.id);
      await newState.setChannel(channel, "Criando sala temporaria").catch(() => null);
    }
  }

  if (oldState.channelId && tempVoiceOwners.has(oldState.channelId)) {
    const channel = oldState.guild.channels.cache.get(oldState.channelId);
    if (channel && channel.members.size === 0) {
      tempVoiceOwners.delete(channel.id);
      await channel.delete("Sala temporaria vazia").catch(() => null);
    }
  }
}

module.exports = {
  ensureServerStructure,
  handleTempVoice,
  managedCategoryNames,
  managedChannelNames,
  roleNames,
  scheduleStructureRestore
};
