#!/usr/bin/env node
/**
 * DAW Remote licence & update API (api.dawremote.app).
 *
 * Environment:
 *   PORT                 default 8787
 *   DATA_DIR             default ./data          (db.json, dev-keys.json)
 *   RELEASES_DIR         default ./releases      (latest.json + zips)
 *   PRIVATE_KEY          default ./.secrets/ed25519-private.pem
 *   PUBLIC_URL           default http://localhost:8787  (for download links)
 *   LEMON_STORE_ID       optional: reject keys from other stores
 *   LEMON_PLAN_MAP       optional JSON {"<variant_id>":"monthly", …}
 *   TRIAL_DAYS           default 14
 *   SEATS_DEFAULT        default 2 (computers per licence)
 */
import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { issue, loadKeys, readToken } from "./tokens.mjs";
import { openStore } from "./store.mjs";
import { LicenseProblem, devKeys, lemonSqueezy } from "./providers.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = process.env;
const PORT = Number(env.PORT || 8787);
const DATA_DIR = resolve(env.DATA_DIR || join(here, "data"));
const RELEASES_DIR = resolve(env.RELEASES_DIR || join(here, "releases"));
const PUBLIC_URL = (env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const TRIAL_DAYS = Number(env.TRIAL_DAYS || 14);
const SEATS_DEFAULT = Number(env.SEATS_DEFAULT || 2);
const DAY = 86400;

const keys = loadKeys(resolve(env.PRIVATE_KEY || join(here, ".secrets/ed25519-private.pem")));
const store = openStore(DATA_DIR);
const dev = devKeys(DATA_DIR);
const lemon = lemonSqueezy({
  storeId: env.LEMON_STORE_ID || null,
  planMap: env.LEMON_PLAN_MAP ? JSON.parse(env.LEMON_PLAN_MAP) : {},
});
const providerFor = (key) => (/^DAWR-/i.test(key) ? dev : lemon);
const now = () => Math.floor(Date.now() / 1000);

/* ----------------------------------------------------------- helpers */

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new LicenseProblem("Solicitud demasiado grande", 413);
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new LicenseProblem("JSON inválido");
  }
}

function machineOf(body) {
  const m = body.machine || {};
  if (typeof m.id !== "string" || !/^[0-9a-f]{32}$/.test(m.id)) throw new LicenseProblem("Computadora no identificada");
  return { id: m.id, name: String(m.name || "Computadora").slice(0, 60), platform: String(m.platform || "").slice(0, 20) };
}

/** Very small per-IP limiter: slows down key guessing. */
const hits = new Map();
function limited(ip, max = 30) {
  const t = Date.now();
  const h = (hits.get(ip) || []).filter((x) => t - x < 60_000);
  h.push(t);
  hits.set(ip, h);
  return h.length > max;
}

/* ----------------------------------------------------------- licences */

function trialToken(machineId) {
  const t = store.db.trials[machineId];
  return issue(keys, { plan: "trial", email: t.email, machineId, until: t.start + TRIAL_DAYS * DAY });
}

async function startTrial(body) {
  const machine = machineOf(body);
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new LicenseProblem("Escribe un correo válido");
  if (store.db.machines[machine.id]) throw new LicenseProblem("Esta computadora ya tiene una licencia activa");
  if (!store.db.trials[machine.id]) {
    const used = store.db.emails[email];
    if (used && used.machineId !== machine.id) throw new LicenseProblem("Ese correo ya usó su prueba gratis");
    store.db.trials[machine.id] = { email, start: now(), name: machine.name };
    store.db.emails[email] = { start: now(), machineId: machine.id };
    store.save();
  }
  return { token: trialToken(machine.id) };
}

async function activate(body) {
  const machine = machineOf(body);
  const key = String(body.license_key || "").trim();
  if (key.length < 8) throw new LicenseProblem("Escribe tu clave de licencia");
  const current = store.db.machines[machine.id];
  if (current && current.key === key) {
    return { token: issue(keys, { ...current, machineId: machine.id }) };
  }
  const provider = providerFor(key);
  const info = await provider.activate(key, machine);
  const seats = info.seats ?? SEATS_DEFAULT;
  if (provider === dev && store.activationsForKey(key).length >= seats) {
    throw new LicenseProblem(`Esta clave ya está activada en ${seats} computadoras. Desactiva una desde la otra computadora o desde tu cuenta.`, 403);
  }
  store.db.machines[machine.id] = {
    key, instanceId: info.instanceId, plan: info.plan, email: info.email, until: info.until,
    name: machine.name, platform: machine.platform, at: now(),
  };
  store.save();
  return { token: issue(keys, { plan: info.plan, email: info.email, key, machineId: machine.id, until: info.until }) };
}

/** Called by the app every day or so while online. */
async function refresh(body) {
  const t = readToken(keys, body.token);
  if (!t) throw new LicenseProblem("Licencia no reconocida", 401);
  const mid = t.mid;
  const m = store.db.machines[mid];
  if (m) {
    let info;
    try {
      info = await providerFor(m.key).validate(m.key, m.instanceId);
    } catch (e) {
      // Payment provider down: keep the musician working on what we know.
      info = { plan: m.plan, email: m.email, until: m.until };
    }
    if (info.revoked) {
      delete store.db.machines[mid];
      store.save();
      return { token: issue(keys, { plan: m.plan, email: m.email, key: m.key, machineId: mid, until: now() - 1 }), message: info.reason };
    }
    Object.assign(m, { plan: info.plan, email: info.email ?? m.email, until: info.until ?? null, seen: now() });
    store.save();
    return { token: issue(keys, { plan: m.plan, email: m.email, key: m.key, machineId: mid, until: m.until }) };
  }
  if (store.db.trials[mid]) return { token: trialToken(mid) };
  throw new LicenseProblem("Esta computadora ya no tiene licencia", 404);
}

async function deactivate(body) {
  const t = readToken(keys, body.token);
  if (!t) throw new LicenseProblem("Licencia no reconocida", 401);
  const m = store.db.machines[t.mid];
  if (m) {
    await providerFor(m.key).deactivate(m.key, m.instanceId).catch(() => {});
    delete store.db.machines[t.mid];
    store.save();
  }
  return { ok: true };
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
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=31536000, immutable",
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
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, time: now() });
    if (req.method === "GET" && url.pathname === "/v1/updates/latest") {
      const m = latest(url.searchParams.get("channel"));
      return m ? send(res, 200, m) : send(res, 404, { error: "Sin versiones publicadas" });
    }
    if (req.method === "GET" && url.pathname.startsWith("/v1/downloads/")) {
      return download(res, decodeURIComponent(url.pathname.slice("/v1/downloads/".length)));
    }
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return send(res, 404, { error: "No encontrado" });
    if (limited(ip)) return send(res, 429, { error: "Demasiados intentos. Espera un minuto." });
    return send(res, 200, await handler(await readJson(req)));
  } catch (e) {
    const status = e instanceof LicenseProblem ? e.status : 500;
    if (status === 500) console.error(e);
    return send(res, status, { error: status === 500 ? "Error del servidor" : e.message });
  }
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`DAW Remote API en ${PUBLIC_URL} (puerto ${PORT})`));
}
