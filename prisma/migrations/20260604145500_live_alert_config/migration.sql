CREATE TABLE "live_alert_configs" (
    "id" TEXT NOT NULL,
    "user_id_discord" TEXT NOT NULL,
    "guild_id" TEXT NOT NULL,
    "streamer_url" TEXT NOT NULL,
    "streamer_name" TEXT NOT NULL,
    "twitch_user_id" TEXT,
    "twitch_avatar_url" TEXT,
    "text_channel_id" TEXT NOT NULL,
    "custom_message" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_stream_id" TEXT,
    "last_live_started_at" TIMESTAMP(3),
    "last_alert_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_alert_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "live_alert_configs_guild_id_streamer_name_key" ON "live_alert_configs"("guild_id", "streamer_name");
CREATE INDEX "live_alert_configs_user_id_discord_idx" ON "live_alert_configs"("user_id_discord");
CREATE INDEX "live_alert_configs_guild_id_idx" ON "live_alert_configs"("guild_id");
CREATE INDEX "live_alert_configs_enabled_idx" ON "live_alert_configs"("enabled");
