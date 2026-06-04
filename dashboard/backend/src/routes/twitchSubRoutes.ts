import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../auth";
import { env } from "../env";
import {
  addDiscordMemberRole,
  assertCanManageGuild,
  listDiscordAlertChannels,
  listDiscordRoles,
  removeDiscordMemberRole,
  sendDiscordChannelMessage,
  validateDiscordAlertChannel
} from "../services/discordGuild";
import {
  exchangeTwitchCode,
  getBroadcasterSubscription,
  getTwitchUserByAccessToken,
  getTwitchUserByLogin,
  refreshTwitchUserToken,
  twitchOAuthUrl
} from "../services/twitch";

export const twitchSubRoutes = Router();

type TwitchSubState = {
  type: "broadcaster" | "viewer";
  guildId: string;
  discordId?: string;
};

const configSchema = z.object({
  guildId: z.string().trim().regex(/^\d{17,20}$/),
  broadcasterLogin: z.string().trim().min(2).max(80).optional().or(z.literal("")),
  primeRoleId: z.string().trim().regex(/^\d{17,20}$/).optional().or(z.literal("")),
  tier1RoleId: z.string().trim().regex(/^\d{17,20}$/).optional().or(z.literal("")),
  tier2RoleId: z.string().trim().regex(/^\d{17,20}$/).optional().or(z.literal("")),
  tier3RoleId: z.string().trim().regex(/^\d{17,20}$/).optional().or(z.literal("")),
  logChannelId: z.string().trim().regex(/^\d{17,20}$/).optional().or(z.literal("")),
  syncIntervalHours: z.coerce.number().int().min(12).max(24).default(12)
});

function signState(state: TwitchSubState) {
  return jwt.sign(state, env.jwtSecret, { expiresIn: "30m" });
}

function verifyState(value: string) {
  return jwt.verify(value, env.jwtSecret) as TwitchSubState;
}

function publicBaseUrl() {
  return env.publicSiteUrl.replace(/\/+$/, "") || env.siteUrl.replace(/\/+$/, "");
}

function tierLabel(tier?: string | null) {
  if (tier === "Prime") return "Prime";
  if (tier === "3000") return "Tier 3";
  if (tier === "2000") return "Tier 2";
  if (tier === "1000") return "Tier 1";
  return tier || "Sem sub";
}

function normalizeSubscriptionTier(subscription?: { tier?: string; plan_name?: string } | null) {
  if (!subscription) return null;
  if (subscription.tier === "Prime" || subscription.plan_name?.toLowerCase().includes("prime")) return "Prime";
  return subscription.tier || null;
}

function roleForTier(config: any, tier?: string | null) {
  if (tier === "Prime") return config.primeRoleId || config.tier1RoleId || null;
  if (tier === "3000") return config.tier3RoleId || null;
  if (tier === "2000") return config.tier2RoleId || null;
  if (tier === "1000") return config.tier1RoleId || null;
  return null;
}

function managedRoleIds(config: any) {
  return [config.primeRoleId, config.tier1RoleId, config.tier2RoleId, config.tier3RoleId].filter(Boolean) as string[];
}

function serializeConfig(config: any) {
  if (!config) return null;

  return {
    id: config.id,
    guildId: config.guildId,
    broadcasterLogin: config.broadcasterLogin || "",
    broadcasterId: config.broadcasterId || "",
    broadcasterConnected: Boolean(config.broadcasterAccessToken && config.broadcasterId),
    primeRoleId: config.primeRoleId || "",
    tier1RoleId: config.tier1RoleId || "",
    tier2RoleId: config.tier2RoleId || "",
    tier3RoleId: config.tier3RoleId || "",
    logChannelId: config.logChannelId || "",
    syncIntervalHours: config.syncIntervalHours,
    updatedAt: config.updatedAt
  };
}

async function logSubAction(
  guildId: string,
  action: string,
  message: string,
  options: { discordUserId?: string; twitchUserId?: string; metadata?: unknown } = {}
) {
  await prisma.twitchSubSyncLog.create({
    data: {
      guildId,
      action,
      message,
      discordUserId: options.discordUserId,
      twitchUserId: options.twitchUserId,
      metadata: options.metadata as any
    }
  });

  const config = await prisma.twitchSubConfig.findUnique({ where: { guildId } });
  if (!config?.logChannelId) return;

  await sendDiscordChannelMessage(config.logChannelId, {
    embeds: [
      {
        color: action.includes("removed") || action.includes("lost") ? 0xef4444 : 0x22c55e,
        title: "Twitch Sub Sync",
        description: message,
        timestamp: new Date().toISOString()
      }
    ]
  }).catch(() => null);
}

async function ensureFreshBroadcasterToken(config: any) {
  if (!config.broadcasterRefreshToken || !config.broadcasterAccessToken) {
    throw new Error("Conecte o canal broadcaster da Twitch antes de sincronizar subs.");
  }

  const expiresAt = config.broadcasterTokenExpiresAt ? new Date(config.broadcasterTokenExpiresAt).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return config;

  const token = await refreshTwitchUserToken(config.broadcasterRefreshToken);
  return prisma.twitchSubConfig.update({
    where: { guildId: config.guildId },
    data: {
      broadcasterAccessToken: token.access_token,
      broadcasterRefreshToken: token.refresh_token || config.broadcasterRefreshToken,
      broadcasterTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000)
    }
  });
}

export async function syncTwitchSubAccount(accountId: string) {
  const account = await prisma.twitchLinkedAccount.findUnique({ where: { id: accountId } });
  if (!account) return null;

  let config = await prisma.twitchSubConfig.findUnique({ where: { guildId: account.guildId } });
  if (!config?.broadcasterId) {
    throw new Error("Configuracao Twitch incompleta.");
  }

  const freshConfig = await ensureFreshBroadcasterToken(config);
  const subscription = await getBroadcasterSubscription(
    freshConfig.broadcasterAccessToken!,
    freshConfig.broadcasterId!,
    account.twitchUserId
  ).catch((error) => {
    if (error instanceof Error && error.message.includes("404")) return { data: [] };
    throw error;
  });

  const sub = subscription.data[0];
  const nextTier = normalizeSubscriptionTier(sub);
  const nextRoleId = roleForTier(freshConfig, nextTier);
  const previousRoleIds = managedRoleIds(freshConfig);

  if (!sub || !nextRoleId) {
    for (const roleId of previousRoleIds) {
      await removeDiscordMemberRole(account.guildId, account.discordUserId, roleId, "Twitch sub expirado").catch(() => null);
    }

    const updated = await prisma.twitchLinkedAccount.update({
      where: { id: account.id },
      data: {
        active: false,
        tier: null,
        roleId: null,
        isGift: null,
        lastCheckedAt: new Date()
      }
    });

    if (account.active) {
      await logSubAction(account.guildId, "sub_lost", `❌ <@${account.discordUserId}> perdeu a inscrição Twitch. Cargo removido.`, {
        discordUserId: account.discordUserId,
        twitchUserId: account.twitchUserId
      });
    }

    return updated;
  }

  for (const roleId of previousRoleIds.filter((roleId) => roleId !== nextRoleId)) {
    await removeDiscordMemberRole(account.guildId, account.discordUserId, roleId, "Twitch sub tier atualizado").catch(() => null);
  }

  await addDiscordMemberRole(account.guildId, account.discordUserId, nextRoleId, `Twitch sub ${tierLabel(nextTier)}`);

  const updated = await prisma.twitchLinkedAccount.update({
    where: { id: account.id },
    data: {
      active: true,
      tier: nextTier,
      roleId: nextRoleId,
      isGift: Boolean(sub.is_gift),
      lastCheckedAt: new Date(),
      lastSubscribedAt: new Date()
    }
  });

  await logSubAction(
    account.guildId,
    "role_added",
    `✅ <@${account.discordUserId}> possui Sub ${tierLabel(nextTier)}. Cargo <@&${nextRoleId}> adicionado.`,
    {
      discordUserId: account.discordUserId,
      twitchUserId: account.twitchUserId,
      metadata: { tier: nextTier, rawTier: sub.tier, planName: sub.plan_name, isGift: sub.is_gift }
    }
  );

  return updated;
}

export async function syncTwitchSubsForGuild(guildId: string) {
  const accounts = await prisma.twitchLinkedAccount.findMany({ where: { guildId } });
  let checked = 0;

  for (const account of accounts) {
    await syncTwitchSubAccount(account.id).catch(async (error) => {
      await logSubAction(guildId, "sync_error", `Erro ao sincronizar ${account.twitchLogin}: ${error instanceof Error ? error.message : "erro"}`, {
        discordUserId: account.discordUserId,
        twitchUserId: account.twitchUserId
      });
    });
    checked += 1;
  }

  return { checked };
}

export async function syncDueTwitchSubGuilds() {
  const configs = await prisma.twitchSubConfig.findMany({ where: { broadcasterId: { not: null } } });
  let guilds = 0;
  let checked = 0;

  for (const config of configs) {
    const lastLog = await prisma.twitchSubSyncLog.findFirst({
      where: { guildId: config.guildId, action: "auto_sync" },
      orderBy: { createdAt: "desc" }
    });
    const intervalMs = config.syncIntervalHours * 60 * 60 * 1000;
    const due = !lastLog || Date.now() - lastLog.createdAt.getTime() >= intervalMs;

    if (!due) continue;

    const result = await syncTwitchSubsForGuild(config.guildId);
    await logSubAction(config.guildId, "auto_sync", `Sincronizacao automatica concluida: ${result.checked} conta(s).`);
    guilds += 1;
    checked += result.checked;
  }

  return { guilds, checked };
}

twitchSubRoutes.get("/connect", (request, response, next) => {
  try {
    const state = String(request.query.state || "");
    const parsed = verifyState(state);

    response.redirect(
      twitchOAuthUrl({
        redirectUri: env.twitchSubRedirectUri,
        state: signState(parsed),
        scopes: ["user:read:email"]
      })
    );
  } catch (error) {
    next(error);
  }
});

twitchSubRoutes.get("/callback", async (request, response, next) => {
  try {
    const code = String(request.query.code || "");
    const state = verifyState(String(request.query.state || ""));

    if (!code) {
      response.status(400).send("Codigo OAuth ausente.");
      return;
    }

    const token = await exchangeTwitchCode(code, env.twitchSubRedirectUri);
    const twitchUser = await getTwitchUserByAccessToken(token.access_token);
    const user = twitchUser.data[0];

    if (!user) {
      response.status(400).send("Nao foi possivel buscar a conta Twitch.");
      return;
    }

    if (state.type === "broadcaster") {
      await prisma.twitchSubConfig.upsert({
        where: { guildId: state.guildId },
        create: {
          guildId: state.guildId,
          broadcasterLogin: user.login,
          broadcasterId: user.id,
          broadcasterAccessToken: token.access_token,
          broadcasterRefreshToken: token.refresh_token || "",
          broadcasterTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000)
        },
        update: {
          broadcasterLogin: user.login,
          broadcasterId: user.id,
          broadcasterAccessToken: token.access_token,
          broadcasterRefreshToken: token.refresh_token || undefined,
          broadcasterTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000)
        }
      });

      await logSubAction(state.guildId, "broadcaster_connected", `✅ Canal Twitch ${user.display_name} conectado para verificacao de subs.`, {
        twitchUserId: user.id
      });
      response.redirect(`${publicBaseUrl()}/?twitch=broadcaster_connected`);
      return;
    }

    if (!state.discordId) {
      response.status(400).send("Discord ID ausente no vinculo.");
      return;
    }

    const account = await prisma.twitchLinkedAccount.upsert({
      where: {
        guildId_discordUserId: {
          guildId: state.guildId,
          discordUserId: state.discordId
        }
      },
      create: {
        guildId: state.guildId,
        discordUserId: state.discordId,
        twitchUserId: user.id,
        twitchLogin: user.login,
        twitchDisplayName: user.display_name,
        twitchAccessToken: token.access_token,
        twitchRefreshToken: token.refresh_token || "",
        twitchTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000)
      },
      update: {
        twitchUserId: user.id,
        twitchLogin: user.login,
        twitchDisplayName: user.display_name,
        twitchAccessToken: token.access_token,
        twitchRefreshToken: token.refresh_token || undefined,
        twitchTokenExpiresAt: new Date(Date.now() + token.expires_in * 1000)
      }
    });

    await logSubAction(state.guildId, "linked", `✅ <@${state.discordId}> vinculou sua Twitch: ${user.display_name}.`, {
      discordUserId: state.discordId,
      twitchUserId: user.id
    });

    await syncTwitchSubAccount(account.id).catch(async (error) => {
      await logSubAction(state.guildId, "first_sync_error", `Vinculo criado, mas a verificacao falhou: ${error instanceof Error ? error.message : "erro"}`, {
        discordUserId: state.discordId,
        twitchUserId: user.id
      });
    });

    response.redirect(`${publicBaseUrl()}/?twitch=linked`);
  } catch (error) {
    next(error);
  }
});

twitchSubRoutes.get("/config", requireAuth, async (request, response, next) => {
  try {
    const guildId = String(request.query.guildId || "");
    await assertCanManageGuild(request.user!.id, guildId);
    const [config, roles, channels, stats, logs] = await Promise.all([
      prisma.twitchSubConfig.findUnique({ where: { guildId } }),
      listDiscordRoles(guildId),
      listDiscordAlertChannels(guildId),
      prisma.twitchLinkedAccount.groupBy({
        by: ["tier", "active"],
        where: { guildId },
        _count: { _all: true }
      }),
      prisma.twitchSubSyncLog.findMany({ where: { guildId }, orderBy: { createdAt: "desc" }, take: 20 })
    ]);

    response.json({ config: serializeConfig(config), roles, channels, stats, logs });
  } catch (error) {
    next(error);
  }
});

twitchSubRoutes.put("/config", requireAuth, async (request, response, next) => {
  try {
    const payload = configSchema.parse(request.body);
    await assertCanManageGuild(request.user!.id, payload.guildId);

    if (payload.logChannelId) {
      await validateDiscordAlertChannel(payload.logChannelId, payload.guildId);
    }

    let broadcaster = {};
    if (payload.broadcasterLogin) {
      const user = await getTwitchUserByLogin(payload.broadcasterLogin.replace(/^@/, ""));
      if (!user.data[0]) {
        response.status(404).json({ error: "Canal Twitch nao encontrado." });
        return;
      }

      broadcaster = {
        broadcasterLogin: user.data[0].login,
        broadcasterId: user.data[0].id
      };
    }

    const config = await prisma.twitchSubConfig.upsert({
      where: { guildId: payload.guildId },
      create: {
        guildId: payload.guildId,
        ...broadcaster,
        primeRoleId: payload.primeRoleId || null,
        tier1RoleId: payload.tier1RoleId || null,
        tier2RoleId: payload.tier2RoleId || null,
        tier3RoleId: payload.tier3RoleId || null,
        logChannelId: payload.logChannelId || null,
        syncIntervalHours: payload.syncIntervalHours
      },
      update: {
        ...broadcaster,
        primeRoleId: payload.primeRoleId || null,
        tier1RoleId: payload.tier1RoleId || null,
        tier2RoleId: payload.tier2RoleId || null,
        tier3RoleId: payload.tier3RoleId || null,
        logChannelId: payload.logChannelId || null,
        syncIntervalHours: payload.syncIntervalHours
      }
    });

    response.json({ config: serializeConfig(config) });
  } catch (error) {
    next(error);
  }
});

twitchSubRoutes.get("/broadcaster/oauth", requireAuth, async (request, response, next) => {
  try {
    const guildId = String(request.query.guildId || "");
    await assertCanManageGuild(request.user!.id, guildId);
    const state = signState({ type: "broadcaster", guildId });

    response.redirect(
      twitchOAuthUrl({
        redirectUri: env.twitchSubRedirectUri,
        state,
        scopes: ["user:read:email", "channel:read:subscriptions"]
      })
    );
  } catch (error) {
    next(error);
  }
});

twitchSubRoutes.post("/sync", requireAuth, async (request, response, next) => {
  try {
    const guildId = String(request.body?.guildId || "");
    await assertCanManageGuild(request.user!.id, guildId);
    const result = await syncTwitchSubsForGuild(guildId);
    await logSubAction(guildId, "manual_sync", `Sincronizacao manual concluida: ${result.checked} conta(s).`, {
      discordUserId: request.user!.id
    });
    response.json(result);
  } catch (error) {
    next(error);
  }
});

twitchSubRoutes.post("/check", async (request, response, next) => {
  try {
    if (request.headers["x-internal-secret"] !== env.internalWebhookSecret) {
      response.status(401).json({ error: "Nao autorizado." });
      return;
    }

    const result = await syncDueTwitchSubGuilds();
    response.json(result);
  } catch (error) {
    next(error);
  }
});
