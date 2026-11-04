import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { readFileSync } from "node:fs";

export const OFFLINE_DAYS = 30;
const DAY = 86400;

const b64u = (buf) => Buffer.from(buf).toString("base64url");

/**
 * Rebuilds a PEM from whatever an env-var field left of it: lines joined with
 * spaces or nothing, literal "\\n", surrounding quotes, or just the base64 body.
 */
export function normalizePem(value) {
  let v = String(value).trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");
  const m = v.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  const label = m ? m[1] : "PRIVATE KEY";
  const body = (m ? m[2] : v).replace(/[^A-Za-z0-9+/=]/g, "");
  return `-----BEGIN ${label}-----\n${body.match(/.{1,64}/g).join("\n")}\n-----END ${label}-----\n`;
}

/** From PRIVATE_KEY_PEM (Hostinger env var) or a file. */
export function loadKeys(privatePath, pem = null) {
  const source = pem ? normalizePem(pem) : readFileSync(privatePath);
  const privateKey = createPrivateKey(source);
  return { privateKey, publicKey: createPublicKey(privateKey) };
}

/** Same format the Live script verifies: base64url(json).base64url(sig). */
export function signToken(keys, payload) {
  const head = b64u(JSON.stringify(payload));
  return `${head}.${b64u(sign(null, Buffer.from(head, "ascii"), keys.privateKey))}`;
}

export function readToken(keys, token) {
  const [head, sig] = String(token || "").split(".");
  if (!head || !sig) return null;
  if (!verify(null, Buffer.from(head, "ascii"), keys.publicKey, Buffer.from(sig, "base64url"))) return null;
  try {
    return JSON.parse(Buffer.from(head, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function issue(keys, { plan, email, key, machineId, until }) {
  const iat = Math.floor(Date.now() / 1000);
  return signToken(keys, {
    v: 1,
    plan,
    email: email || null,
    key: key ? String(key).slice(-4).toUpperCase() : null,
    mid: machineId,
    iat,
    exp: iat + OFFLINE_DAYS * DAY,
    until: until ?? null,
  });
}

/** Signature for an update package (see midi-script/Licensing/updater.py). */
export function signUpdate(keys, version, sha256) {
  return sign(null, Buffer.from(`dawremote-update:${version}:${sha256}`), keys.privateKey).toString("hex");
}
