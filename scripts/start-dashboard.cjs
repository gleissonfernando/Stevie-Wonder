process.env.NODE_ENV ||= "production";
process.env.PORT ||= "80";
process.env.START_DISCORD_BOT ||= "false";

require("tsx/cjs");
require("../dashboard/backend/src/server.ts");
