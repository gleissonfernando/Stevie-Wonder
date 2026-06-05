const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey() {
  const source =
    process.env.TWITCH_TOKEN_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    "dev-only-change-this-twitch-token-key";

  return crypto.createHash("sha256").update(source).digest();
}

function encryptToken(value) {
  if (!value) return "";

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

function decryptToken(value) {
  if (!value) return "";

  const [iv, tag, encrypted] = String(value).split(":");
  if (!iv || !tag || !encrypted) return "";

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final()
  ]).toString("utf8");
}

module.exports = {
  decryptToken,
  encryptToken
};
