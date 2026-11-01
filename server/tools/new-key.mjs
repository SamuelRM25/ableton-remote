#!/usr/bin/env node
/**
 * Creates a licence key handled by this server (not Lemon Squeezy):
 * for you, testers, gifts or partners.
 *
 *   node tools/new-key.mjs owner samipuro@… 3        → plan, e-mail, computers
 *   node tools/new-key.mjs lifetime tester@… 2
 *   node tools/new-key.mjs annual amigo@… 1 365      → … and days it lasts
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = resolve(process.env.DATA_DIR || join(here, "data"));
const [plan = "lifetime", email = "", seats = "2", days] = process.argv.slice(2);
const file = join(dir, "dev-keys.json");
mkdirSync(dir, { recursive: true });
const all = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
const part = () => randomBytes(3).toString("hex").toUpperCase();
const key = `DAWR-${part()}-${part()}-${part()}`;
all[key] = {
  plan,
  email,
  seats: Number(seats),
  until: days ? Math.floor(Date.now() / 1000) + Number(days) * 86400 : null,
  created: new Date().toISOString(),
};
writeFileSync(file, JSON.stringify(all, null, 2));
console.log(key);
