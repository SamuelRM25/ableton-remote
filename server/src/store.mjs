import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Persistence for licences. Two implementations with the same async API:
 *   - MySQL (production on Hostinger: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD)
 *   - a JSON file (local development only — Hostinger wipes files on deploy)
 *
 * Rows:
 *   trial      { machineId, email, start, name }
 *   activation { machineId, key, instanceId, plan, email, until, name, platform, createdAt, seenAt, revoked }
 *   devKey     { key, plan, email, seats, until, revoked, createdAt }
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS trials (
     machine_id CHAR(32) PRIMARY KEY,
     email VARCHAR(190) NOT NULL UNIQUE,
     start INT UNSIGNED NOT NULL,
     name VARCHAR(80) NULL
   ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS activations (
     machine_id CHAR(32) PRIMARY KEY,
     license_key VARCHAR(100) NOT NULL,
     instance_id VARCHAR(100) NULL,
     plan VARCHAR(20) NOT NULL,
     email VARCHAR(190) NULL,
     until INT UNSIGNED NULL,
     name VARCHAR(80) NULL,
     platform VARCHAR(20) NULL,
     created_at INT UNSIGNED NOT NULL,
     seen_at INT UNSIGNED NULL,
     revoked TINYINT(1) NOT NULL DEFAULT 0,
     INDEX (license_key)
   ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS dev_keys (
     license_key VARCHAR(100) PRIMARY KEY,
     plan VARCHAR(20) NOT NULL,
     email VARCHAR(190) NULL,
     seats INT NOT NULL DEFAULT 2,
     until INT UNSIGNED NULL,
     revoked TINYINT(1) NOT NULL DEFAULT 0,
     created_at INT UNSIGNED NOT NULL
   ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS events (
     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     at INT UNSIGNED NOT NULL,
     kind VARCHAR(40) NOT NULL,
     detail TEXT NULL
   ) CHARACTER SET utf8mb4`,
];

const now = () => Math.floor(Date.now() / 1000);

const actFromRow = (r) =>
  r && {
    machineId: r.machine_id,
    key: r.license_key,
    instanceId: r.instance_id,
    plan: r.plan,
    email: r.email,
    until: r.until,
    name: r.name,
    platform: r.platform,
    createdAt: r.created_at,
    seenAt: r.seen_at,
    revoked: !!r.revoked,
  };

export async function openMysqlStore(cfg) {
  const mysql = await import("mysql2/promise");
  const pool = mysql.createPool({
    host: cfg.host,
    port: cfg.port || 3306,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectionLimit: 4,
    charset: "utf8mb4",
  });
  for (const sql of SCHEMA) await pool.query(sql);
  const one = async (sql, args) => (await pool.query(sql, args))[0][0];

  return {
    kind: "mysql",
    async getTrial(machineId) {
      const r = await one("SELECT * FROM trials WHERE machine_id = ?", [machineId]);
      return r && { machineId: r.machine_id, email: r.email, start: r.start, name: r.name };
    },
    async trialByEmail(email) {
      const r = await one("SELECT * FROM trials WHERE email = ?", [email]);
      return r && { machineId: r.machine_id, email: r.email, start: r.start };
    },
    async addTrial(t) {
      await pool.query("INSERT INTO trials (machine_id, email, start, name) VALUES (?, ?, ?, ?)", [t.machineId, t.email, t.start, t.name]);
    },
    async getActivation(machineId) {
      return actFromRow(await one("SELECT * FROM activations WHERE machine_id = ?", [machineId]));
    },
    async countActivations(key) {
      return (await one("SELECT COUNT(*) AS n FROM activations WHERE license_key = ? AND revoked = 0", [key])).n;
    },
    async putActivation(a) {
      await pool.query(
        `REPLACE INTO activations (machine_id, license_key, instance_id, plan, email, until, name, platform, created_at, seen_at, revoked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [a.machineId, a.key, a.instanceId ?? null, a.plan, a.email ?? null, a.until ?? null, a.name ?? null, a.platform ?? null, a.createdAt ?? now(), a.seenAt ?? null, a.revoked ? 1 : 0],
      );
    },
    async deleteActivation(machineId) {
      await pool.query("DELETE FROM activations WHERE machine_id = ?", [machineId]);
    },
    async revokeKey(key) {
      const [res] = await pool.query("UPDATE activations SET revoked = 1 WHERE license_key = ?", [key]);
      await pool.query("UPDATE dev_keys SET revoked = 1 WHERE license_key = ?", [key]);
      return res.affectedRows;
    },
    async getDevKey(key) {
      const r = await one("SELECT * FROM dev_keys WHERE license_key = ?", [key]);
      return r && { key: r.license_key, plan: r.plan, email: r.email, seats: r.seats, until: r.until, revoked: !!r.revoked };
    },
    async putDevKey(k) {
      await pool.query(
        "REPLACE INTO dev_keys (license_key, plan, email, seats, until, revoked, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [k.key, k.plan, k.email ?? null, k.seats ?? 2, k.until ?? null, k.revoked ? 1 : 0, now()],
      );
    },
    async log(kind, detail) {
      await pool.query("INSERT INTO events (at, kind, detail) VALUES (?, ?, ?)", [now(), kind, detail ? JSON.stringify(detail).slice(0, 4000) : null]).catch(() => {});
    },
    async close() {
      await pool.end();
    },
  };
}

export function openJsonStore(dir) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "db.json");
  const db = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  db.trials ??= {};
  db.machines ??= {};
  db.devKeys ??= {};
  // Keys made by the Fase 1 tool lived in dev-keys.json.
  const legacy = join(dir, "dev-keys.json");
  if (existsSync(legacy)) Object.assign(db.devKeys, JSON.parse(readFileSync(legacy, "utf8")));
  const save = () => {
    writeFileSync(file + ".tmp", JSON.stringify(db, null, 2));
    renameSync(file + ".tmp", file);
  };
  return {
    kind: "json",
    async getTrial(machineId) {
      const t = db.trials[machineId];
      return t && { machineId, ...t };
    },
    async trialByEmail(email) {
      const e = Object.entries(db.trials).find(([, t]) => t.email === email);
      return e && { machineId: e[0], ...e[1] };
    },
    async addTrial(t) {
      db.trials[t.machineId] = { email: t.email, start: t.start, name: t.name };
      save();
    },
    async getActivation(machineId) {
      const m = db.machines[machineId];
      return m && { machineId, revoked: false, ...m };
    },
    async countActivations(key) {
      return Object.values(db.machines).filter((m) => m.key === key && !m.revoked).length;
    },
    async putActivation(a) {
      const { machineId, ...rest } = a;
      db.machines[machineId] = { createdAt: now(), ...rest };
      save();
    },
    async deleteActivation(machineId) {
      delete db.machines[machineId];
      save();
    },
    async revokeKey(key) {
      let n = 0;
      for (const m of Object.values(db.machines)) if (m.key === key) (m.revoked = true), n++;
      if (db.devKeys[key]) db.devKeys[key].revoked = true;
      save();
      return n;
    },
    async getDevKey(key) {
      const k = db.devKeys[key];
      return k && { key, ...k };
    },
    async putDevKey(k) {
      const { key, ...rest } = k;
      db.devKeys[key] = { ...rest, created: new Date().toISOString() };
      save();
    },
    async log() {},
    async close() {},
  };
}

/** MySQL when DB_HOST is set, otherwise the JSON file (development). */
export async function openStore(env, dataDir) {
  if (env.DB_HOST) {
    return openMysqlStore({
      host: env.DB_HOST,
      port: Number(env.DB_PORT || 3306),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    });
  }
  return openJsonStore(dataDir);
}
