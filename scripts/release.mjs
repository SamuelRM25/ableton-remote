#!/usr/bin/env node
/**
 * Builds a DAW Remote release from the version in package.json.
 *
 *   npm run release            → public build (licence required)
 *   npm run release -- --dev   → same, but without licence check (for you)
 *
 * Produces:
 *   build/DAWRemote/                       the Remote Script folder, ready to install
 *   server/releases/DAWRemote-X.Y.Z.zip    the signed update package
 *   server/releases/latest.json            what the app checks for updates
 *
 * Needs the private key from `node scripts/keys.mjs` (server/.secrets/).
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";
import { loadKeys, signUpdate } from "../server/src/tokens.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dev = process.argv.includes("--dev");
const skipBuild = process.argv.includes("--no-build");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const version = pkg.version;

/* 1. One version everywhere */
const setJsonVersion = (f) => {
  const p = join(root, f);
  const j = JSON.parse(readFileSync(p, "utf8"));
  if (j.version !== version) writeFileSync(p, JSON.stringify({ ...j, version }, null, 2) + "\n");
};
setJsonVersion("web/package.json");
setJsonVersion("server/package.json");
const configPath = join(root, "midi-script/Config.py");
writeFileSync(configPath, readFileSync(configPath, "utf8").replace(/^APP_VERSION = ".*"$/m, `APP_VERSION = "${version}"`));

/* 2. Web app */
if (!skipBuild) execSync("npm run build", { cwd: root, stdio: "inherit" });

/* 3. Remote Script folder */
const out = join(root, "build/DAWRemote");
rmSync(join(root, "build"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const skip = /(^|\/)(__pycache__|_pending|static|\.DS_Store|ruff\.toml|setup\.cfg)(\/|$)|\.pyc$/;
cpSync(join(root, "midi-script"), out, {
  recursive: true,
  filter: (src) => !skip.test(relative(join(root, "midi-script"), src)),
});
cpSync(join(root, "web/dist"), join(out, "static"), {
  recursive: true,
  filter: (src) => !src.endsWith(".map") && !src.includes("_update"),
});
cpSync(join(root, "NOTICE.md"), join(out, "NOTICE.md"));
const outConfig = join(out, "Config.py");
writeFileSync(
  outConfig,
  readFileSync(outConfig, "utf8").replace(/^LICENSE_REQUIRED = .*$/m, `LICENSE_REQUIRED = ${dev ? "False" : "True"}`),
);

/* 4. Zip (single top folder "DAWRemote/") */
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files[`DAWRemote/${relative(out, p).split("\\").join("/")}`] = [readFileSync(p), { mtime: new Date("2026-01-01") }];
  }
};
walk(out);
const zip = Buffer.from(zipSync(files, { level: 9 }));
const sha256 = createHash("sha256").update(zip).digest("hex");

/* 5. Sign + manifest */
const keys = loadKeys(join(root, "server/.secrets/ed25519-private.pem"));
const signature = signUpdate(keys, version, sha256);
const rel = join(root, "server/releases");
mkdirSync(rel, { recursive: true });
const file = `DAWRemote-${version}${dev ? "-dev" : ""}.zip`;
writeFileSync(join(rel, file), zip);

const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8");
const section = changelog.split(/^## /m).find((s) => s.startsWith(version)) || "";
const notes = section.split("\n").slice(1).join("\n").trim();

const manifest = {
  version,
  date: new Date().toISOString().slice(0, 10),
  file,
  size: zip.length,
  sha256,
  signature,
  min_live: "11.0",
  notes,
};
if (!dev) writeFileSync(join(rel, "latest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`\n✓ DAW Remote ${version}${dev ? " (dev, sin licencia)" : ""}`);
console.log(`  carpeta  build/DAWRemote  (${Object.keys(files).length} archivos)`);
console.log(`  paquete  server/releases/${file}  ${(zip.length / 1024).toFixed(0)} KB`);
if (!dev) console.log("  manifest server/releases/latest.json");
