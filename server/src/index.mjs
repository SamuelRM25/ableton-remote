#!/usr/bin/env node
/**
 * DAW Remote licence & update API (api.dawremote.app).
 *
 * Environment (Hostinger → Variables de entorno):
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD   MySQL (required in production)
 *   PRIVATE_KEY_PEM        contents of server/.secrets/ed25519-private.pem
 *   PUBLIC_URL             https://api.dawremote.app
 *   LEMON_STORE_ID         reject keys from other Lemon Squeezy stores
 *   LEMON_WEBHOOK_SECRET   signing secret of the Lemon Squeezy webhook
 *   LEMON_PLAN_MAP         optional JSON {"<variant_id>":"monthly", …}
 *   TRIAL_DAYS             default 30
 *   SEATS_DEFAULT          default 2 (computers per licence)
 * Development only: PORT (default 8787), DATA_DIR (JSON store), PRIVATE_KEY (file path).
 */
import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { issue, loadKeys, readToken } from "./tokens.mjs";
import { openStore } from "./store.mjs";
import { LicenseProblem, lemonSqueezy, ownKeys } from "./providers.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;
const PORT = Number(env.PORT || 8787);
const RELEASES_DIR = resolve(env.RELEASES_DIR || join(here, "releases"));
const PUBLIC_URL = (env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const TRIAL_DAYS = Number(env.TRIAL_DAYS || 30);
const SEATS_DEFAULT = Number(env.SEATS_DEFAULT || 2);
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

const keys = loadKeys(resolve(env.PRIVATE_KEY || join(here, ".secrets/ed25519-private.pem")), env.PRIVATE_KEY_PEM || null);
const store = await openStore(env, resolve(env.DATA_DIR || join(here, "data")));
if (store.kind !== "mysql") console.warn("⚠ Sin DB_HOST: usando archivo JSON (solo para desarrollo).");
const own = ownKeys(store);
const lemon = lemonSqueezy({
  storeId: env.LEMON_STORE_ID || null,
  planMap: env.LEMON_PLAN_MAP ? JSON.parse(env.LEMON_PLAN_MAP) : {},
});
const providerFor = (key) => (/^DAWR-/i.test(key) ? own : lemon);

/* ----------------------------------------------------------- helpers */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS, ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function readRaw(req, limit = 256 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw new LicenseProblem("Solicitud demasiado grande", 413);
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function parseJson(buf) {
  try {
    return JSON.parse(buf.toString("utf8") || "{}");
  } catch {
    throw new LicenseProblem("JSON inválido");
  }
}

function machineOf(body) {
  const m = body.machine || {};
  if (typeof m.id !== "string" || !/^[0-9a-f]{32}$/.test(m.id)) throw new LicenseProblem("Computadora no identificada");
  return { id: m.id, name: String(m.name || "Computadora").slice(0, 60), platform: String(m.platform || "").slice(0, 20) };
}

/** Small per-IP limiter: slows down key guessing. */
const hits = new Map();
function limited(ip, max = 30) {
  const t = Date.now();
  const h = (hits.get(ip) || []).filter((x) => t - x < 60_000);
  h.push(t);
  hits.set(ip, h);
  if (hits.size > 5000) hits.clear();
  return h.length > max;
}

const tokenFor = (a) => issue(keys, { plan: a.plan, email: a.email, key: a.key, machineId: a.machineId, until: a.revoked ? now() - 1 : a.until });

/* ----------------------------------------------------------- licences */

async function trialToken(machineId) {
  const t = await store.getTrial(machineId);
  return issue(keys, { plan: "trial", email: t.email, machineId, until: t.start + TRIAL_DAYS * DAY });
}

async function startTrial(body) {
  const machine = machineOf(body);
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 190) throw new LicenseProblem("Escribe un correo válido");
  const act = await store.getActivation(machine.id);
  if (act && !act.revoked) throw new LicenseProblem("Esta computadora ya tiene una licencia activa");
  if (!(await store.getTrial(machine.id))) {
    const used = await store.trialByEmail(email);
    if (used) throw new LicenseProblem("Ese correo ya usó su prueba gratis");
    await store.addTrial({ machineId: machine.id, email, start: now(), name: machine.name });
    await store.log("trial", { email, machine: machine.name });
  }
  return { token: await trialToken(machine.id) };
}

async function activate(body) {
  const machine = machineOf(body);
  const key = String(body.license_key || "").trim();
  if (key.length < 8 || key.length > 100) throw new LicenseProblem("Escribe tu clave de licencia");
  const current = await store.getActivation(machine.id);
  if (current && current.key === key && !current.revoked) return { token: tokenFor(current) };

  const provider = providerFor(key);
  const info = await provider.activate(key, machine);
  const seats = info.seats ?? SEATS_DEFAULT;
  // Lemon Squeezy enforces its own activation limit; our own keys are counted here.
  if (provider === own && (await store.countActivations(key)) >= seats) {
    throw new LicenseProblem(`Esta clave ya está activada en ${seats} computadoras. Desactiva una desde la otra computadora o desde tu cuenta.`, 403);
  }
  const a = {
    machineId: machine.id, key, instanceId: info.instanceId, plan: info.plan, email: info.email,
    until: info.until, name: machine.name, platform: machine.platform, createdAt: now(), seenAt: now(),
  };
  await store.putActivation(a);
  await store.log("activate", { plan: a.plan, email: a.email, machine: a.name });
  return { token: tokenFor(a) };
}

/** Called by the app about once a day while online. */
async function refresh(body) {
  const t = readToken(keys, body.token);
  if (!t) throw new LicenseProblem("Licencia no reconocida", 401);
  const a = await store.getActivation(t.mid);
  if (a) {
    if (a.revoked) return { token: tokenFor(a), message: "La licencia fue cancelada o reembolsada" };
    let info;
    try {
      info = await providerFor(a.key).validate(a.key, a.instanceId);
    } catch {
      // Payment provider down: keep the musician working on what we know.
      info = { plan: a.plan, email: a.email, until: a.until };
    }
    if (info.revoked) {
      const next = { ...a, revoked: true, seenAt: now() };
      await store.putActivation(next);
      return { token: tokenFor(next), message: info.reason };
    }
    const next = { ...a, plan: info.plan, email: info.email ?? a.email, until: info.until ?? null, seenAt: now() };
    await store.putActivation(next);
    return { token: tokenFor(next) };
  }
  if (await store.getTrial(t.mid)) return { token: await trialToken(t.mid) };
  throw new LicenseProblem("Esta computadora ya no tiene licencia", 404);
}

async function deactivate(body) {
  const t = readToken(keys, body.token);
  if (!t) throw new LicenseProblem("Licencia no reconocida", 401);
  const a = await store.getActivation(t.mid);
  if (a) {
    if (!a.revoked) await providerFor(a.key).deactivate(a.key, a.instanceId).catch(() => {});
    await store.deleteActivation(t.mid);
    await store.log("deactivate", { machine: a.name });
  }
  return { ok: true };
}

/* ----------------------------------------------------------- Lemon Squeezy webhooks */

/**
 * Lemon Squeezy → Settings → Webhooks → https://api.dawremote.app/v1/webhooks/lemonsqueezy
 * Events: license_key_updated, order_refunded, subscription_expired.
 * A refund or a disabled / expired key revokes every computer using it;
 * the app finds out on its next daily check.
 */
async function lemonWebhook(req, res) {
  const raw = await readRaw(req, 1024 * 1024);
  const secret = env.LEMON_WEBHOOK_SECRET;
  const sig = Buffer.from(String(req.headers["x-signature"] || ""), "utf8");
  const expected = Buffer.from(secret ? createHmac("sha256", secret).update(raw).digest("hex") : "", "utf8");
  if (!secret || sig.length !== expected.length || !timingSafeEqual(sig, expected)) {
    return send(res, 401, { error: "Firma inválida" });
  }
  const body = parseJson(raw);
  const event = body.meta?.event_name;
  const attrs = body.data?.attributes || {};
  await store.log(`lemon:${event}`, { id: body.data?.id, status: attrs.status });
  if (event === "license_key_updated" && ["disabled", "expired"].includes(attrs.status) && attrs.key) {
    await store.revokeKey(attrs.key);
  }
  // order_refunded / subscription_expired disable the order's licence keys in
  // Lemon Squeezy, which sends license_key_updated; validate() also catches it.
  return send(res, 200, { ok: true });
}

/* ----------------------------------------------------------- updates */

function latest(channel) {
  const f = join(RELEASES_DIR, channel === "beta" ? "beta.json" : "latest.json");
  if (!existsSync(f)) return null;
  const m = JSON.parse(readFileSync(f, "utf8"));
  return { ...m, url: m.url?.startsWith("http") ? m.url : `${PUBLIC_URL}/v1/downloads/${m.file}` };
}

function download(res, name) {
  const file = join(RELEASES_DIR, basename(name));
  if (!/\.(zip|pkg|exe|dmg)$/.test(file) || !existsSync(file)) return send(res, 404, { error: "No encontrado" });
  res.writeHead(200, {
    "Content-Type": file.endsWith(".zip") ? "application/zip" : "application/octet-stream",
    "Content-Length": statSync(file).size,
    "Content-Disposition": `attachment; filename="${basename(file)}"`,
    "Cache-Control": "public, max-age=31536000, immutable",
    ...CORS,
  });
  createReadStream(file).pipe(res);
}

/* ----------------------------------------------------------- routing */

const routes = {
  "POST /v1/trial": startTrial,
  "POST /v1/activate": activate,
  "POST /v1/refresh": refresh,
  "POST /v1/deactivate": deactivate,
};

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.socket.remoteAddress || "?";
  try {
    if (req.method === "OPTIONS") return send(res, 204);
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return send(res, 200, { ok: true, service: "DAW Remote API", store: store.kind, time: now() });
    }
    if (req.method === "GET" && url.pathname === "/v1/updates/latest") {
      const m = latest(url.searchParams.get("channel"));
      return m ? send(res, 200, m) : send(res, 404, { error: "Sin versiones publicadas" });
    }
    if (req.method === "GET" && url.pathname.startsWith("/v1/downloads/")) {
      return download(res, decodeURIComponent(url.pathname.slice("/v1/downloads/".length)));
    }
    if (req.method === "POST" && url.pathname === "/v1/webhooks/lemonsqueezy") return await lemonWebhook(req, res);
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return send(res, 404, { error: "No encontrado" });
    if (limited(ip)) return send(res, 429, { error: "Demasiados intentos. Espera un minuto." });
    return send(res, 200, await handler(parseJson(await readRaw(req, 64 * 1024))));
  } catch (e) {
    const status = e instanceof LicenseProblem ? e.status : 500;
    if (status === 500) console.error(e);
    return send(res, status, { error: status === 500 ? "Error del servidor" : e.message });
  }
});

// Hostinger starts the entry file through its own launcher, so always listen
// (tests import this module with NO_LISTEN=1).
if (!env.NO_LISTEN) {
  server.listen(PORT, () => console.log(`DAW Remote API en ${PUBLIC_URL} (puerto ${PORT}, datos: ${store.kind})`));
}
