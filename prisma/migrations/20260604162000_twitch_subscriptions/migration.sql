CREATE TABLE "twitch_sub_configs" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "broadcaster_login" TEXT,
    "broadcaster_id" TEXT,
    "broadcaster_access_token" TEXT,
    "broadcaster_refresh_token" TEXT,
    "broadcaster_token_expires_at" TIMESTAMP(3),
    "prime_role_id" TEXT,
    "tier1_role_id" TEXT,
    "tier2_role_id" TEXT,
    "tier3_role_id" TEXT,
    "log_channel_id" TEXT,
    "sync_interval_hours" INTEGER NOT NULL DEFAULT 12,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitch_sub_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "twitch_linked_accounts" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "discord_user_id" TEXT NOT NULL,
    "twitch_user_id" TEXT NOT NULL,
    "twitch_login" TEXT NOT NULL,
    "twitch_display_name" TEXT NOT NULL,
    "twitch_access_token" TEXT,
    "twitch_refresh_token" TEXT,
    "twitch_token_expires_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "tier" TEXT,
    "role_id" TEXT,
    "is_gift" BOOLEAN,
    "last_checked_at" TIMESTAMP(3),
    "last_subscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "twitch_linked_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "twitch_sub_sync_logs" (
    "id" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "discord_user_id" TEXT,
    "twitch_user_id" TEXT,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "twitch_sub_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "twitch_sub_configs_guild_id_key" ON "twitch_sub_configs"("guild_id");
CREATE INDEX "twitch_sub_configs_guild_id_idx" ON "twitch_sub_configs"("guild_id");
CREATE UNIQUE INDEX "twitch_linked_accounts_guild_id_discord_user_id_key" ON "twitch_linked_accounts"("guild_id", "discord_user_id");
CREATE UNIQUE INDEX "twitch_linked_accounts_guild_id_twitch_user_id_key" ON "twitch_linked_accounts"("guild_id", "twitch_user_id");
CREATE INDEX "twitch_linked_accounts_guild_id_idx" ON "twitch_linked_accounts"("guild_id");
CREATE INDEX "twitch_linked_accounts_active_idx" ON "twitch_linked_accounts"("active");
CREATE INDEX "twitch_sub_sync_logs_guild_id_idx" ON "twitch_sub_sync_logs"("guild_id");
CREATE INDEX "twitch_sub_sync_logs_created_at_idx" ON "twitch_sub_sync_logs"("created_at");
