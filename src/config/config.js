module.exports = {
  defaultPrefix: process.env.DEFAULT_PREFIX || "!",
  ownerIds: (process.env.OWNER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
  colors: {
    primary: 0x5865f2,
    success: 0x57f287,
    warning: 0xfee75c,
    danger: 0xed4245,
    neutral: 0x2b2d31
  }
};
