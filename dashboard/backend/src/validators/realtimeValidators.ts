import { z } from "zod";
import { env } from "../env";

const snowflake = z.string().regex(/^\d{17,20}$/);

export const baseActionSchema = z.object({
  guildId: snowflake.default(env.guildId)
});

export const updateConfigSchema = baseActionSchema.extend({
  key: z.string().trim().min(1).max(80),
  value: z.union([z.string().max(1000), z.boolean(), z.number(), z.record(z.string(), z.unknown())])
});

export const sendAnnouncementSchema = baseActionSchema.extend({
  channelId: snowflake,
  message: z.string().trim().min(1).max(1900)
});

export const createPanelSchema = baseActionSchema.extend({
  channelId: snowflake,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(1000)
});

export const updatePanelSchema = createPanelSchema.extend({
  messageId: snowflake
});

export const setLogChannelSchema = baseActionSchema.extend({
  channelId: snowflake
});

export const setWelcomeMessageSchema = baseActionSchema.extend({
  message: z.string().trim().min(1).max(1000)
});

export const setAutoRoleSchema = baseActionSchema.extend({
  roleId: snowflake
});

export const toggleSystemSchema = baseActionSchema.extend({
  system: z.string().trim().min(1).max(80),
  enabled: z.boolean()
});

export const realtimeSchemas = {
  "site:updateConfig": updateConfigSchema,
  "site:sendAnnouncement": sendAnnouncementSchema,
  "site:createPanel": createPanelSchema,
  "site:updatePanel": updatePanelSchema,
  "site:setLogChannel": setLogChannelSchema,
  "site:setWelcomeMessage": setWelcomeMessageSchema,
  "site:setAutoRole": setAutoRoleSchema,
  "site:toggleSystem": toggleSystemSchema
};

export type SiteActionName = keyof typeof realtimeSchemas;
