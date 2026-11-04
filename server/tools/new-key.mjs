#!/usr/bin/env node
/**
 * Creates a licence key handled by this server (not Lemon Squeezy):
 * for you, testers, gifts or partners. Uses the same database as the API
 * (set DB_HOST, DB_NAME, DB_USER, DB_PASSWORD to write to production).
 *
 *   node tools/new-key.mjs owner tu@correo 3        → plan, e-mail, computers
 *   node tools/new-key.mjs lifetime tester@… 2
 *   node tools/new-key.mjs annual amigo@… 1 365     → … and days it lasts
 *   node tools/new-key.mjs revoke DAWR-XXXX-…       → disables a key
 */
import { randomBytes } from "node:crypto";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "../src/store.mjs";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const store = await openStore(process.env, resolve(process.env.DATA_DIR || join(here, "data")));
const [plan = "lifetime", emailOrKey = "", seats = "2", days] = process.argv.slice(2);

if (plan === "revoke") {
  const n = await store.revokeKey(emailOrKey);
  console.log(`Clave desactivada (${n} computadoras afectadas)`);
} else {
  const part = () => randomBytes(3).toString("hex").toUpperCase();
  const key = `DAWR-${part()}-${part()}-${part()}`;
  await store.putDevKey({
    key,
    plan,
    email: emailOrKey || null,
    seats: Number(seats),
    until: days ? Math.floor(Date.now() / 1000) + Number(days) * 86400 : null,
  });
  console.log(key);
}
await store.close();
