import { createHmac, randomBytes } from "node:crypto";

/** Bilhete de entrada única para o Twin: assinado (HMAC-SHA256), válido 60 s, uso único (nonce). */
export function createTwinTicket(userId: string): string | null {
  const key = process.env.TWIN_SSO_SECRET?.trim();
  if (!key || key.length < 32) return null;
  const body = Buffer.from(
    JSON.stringify({ purpose: "twin-sso", sub: userId, exp: Date.now() + 60_000, n: randomBytes(12).toString("hex") }),
  ).toString("base64url");
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}
