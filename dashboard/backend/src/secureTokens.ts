import crypto from "crypto";
import { env } from "./env";

const algorithm = "aes-256-gcm";
const tokenPrefix = "v1";

function key() {
  return crypto.createHash("sha256").update(env.jwtSecret).digest();
}

export function encryptToken(value?: string | null) {
  if (!value) return undefined;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [tokenPrefix, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptToken(value?: string | null) {
  if (!value) return "";

  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== tokenPrefix || !iv || !tag || !encrypted) return "";

  try {
    const decipher = crypto.createDecipheriv(algorithm, key(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return "";
  }
}
