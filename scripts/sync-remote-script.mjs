#!/usr/bin/env node
/**
 * Copies the production SPA build into the MIDI Remote Script's static
 * folder so Live can serve it from the same origin as the WebSocket.
 *
 * Run after `npm run build`:
 *   node scripts/sync-remote-script.mjs
 *
 * Then install midi-script into Ableton's Remote Scripts folder:
 *   cp -R midi-script ~/Music/Ableton/User\ Library/Remote\ Scripts/AbletonJS
 */
import { cp, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "web/dist");
const dst = resolve(root, "midi-script/static");

if (!existsSync(src)) {
  console.error(
    "✗ web/dist no existe. Ejecuta `npm run build` primero.",
  );
  process.exit(1);
}

await rm(dst, { recursive: true, force: true });
await mkdir(dst, { recursive: true });
await cp(src, dst, { recursive: true });

console.log(`✓ Copiado: web/dist → midi-script/static`);
console.log("  Ahora instala el MIDI script en Ableton:");
console.log("    cp -R midi-script ~/Music/Ableton/User\\ Library/Remote\\ Scripts/AbletonJS");
console.log("  Reinicia Live y selecciona AbletonJS como Control Surface.");
