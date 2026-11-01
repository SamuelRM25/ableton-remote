import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { readFileSync } from "node:fs";

export const OFFLINE_DAYS = 30;
const DAY = 86400;

const b64u = (buf) => Buffer.from(buf).toString("base64url");

export function loadKeys(privatePath) {
  const privateKey = createPrivateKey(readFileSync(privatePath));
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
