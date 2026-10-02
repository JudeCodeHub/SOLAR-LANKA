import { createSign, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { TMP_DIR } from "./paths.ts";

export const ISSUER = "https://test.clerk.invalid";
export const AUTHORIZED_PARTY = "http://localhost:3000";

const b64 = (value: Buffer | string) => Buffer.from(value).toString("base64url");

/** A throwaway RSA key pair, made once per checkout and never committed (the folder is ignored). */
export function ensureKeys(): { privateKey: string; publicKey: string } {
  mkdirSync(TMP_DIR, { recursive: true });
  const privatePath = join(TMP_DIR, "test-key.pem");
  const publicPath = join(TMP_DIR, "test-pub.pem");
  if (!existsSync(privatePath) || !existsSync(publicPath)) {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    writeFileSync(privatePath, privateKey, { mode: 0o600 });
    writeFileSync(publicPath, publicKey);
  }
  return { privateKey: readFileSync(privatePath, "utf8"), publicKey: readFileSync(publicPath, "utf8") };
}

/** A session token the backend accepts when it is started with the matching public key. */
export function signToken(subject: string, privateKey: string, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64(
    JSON.stringify({ iss: ISSUER, sub: subject, sid: `sess_${subject}`, azp: AUTHORIZED_PARTY, iat: nowSeconds, nbf: nowSeconds - 5, exp: nowSeconds + 3600 }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(privateKey);
  return `${header}.${payload}.${b64(signature)}`;
}
