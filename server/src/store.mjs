import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Tiny JSON-file store. Enough for the beta; Fase 2 moves this to MySQL on
 * Hostinger behind the same functions.
 *
 * trials:   machineId → { email, start }
 * emails:   email → { start, machineId }            (one trial per e-mail)
 * machines: machineId → { key, instanceId, plan, email, until, name, at }
 */
export function openStore(dir) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "db.json");
  const db = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { trials: {}, emails: {}, machines: {} };
  const save = () => {
    writeFileSync(file + ".tmp", JSON.stringify(db, null, 2));
    renameSync(file + ".tmp", file);
  };
  return {
    db,
    save,
    activationsForKey(key) {
      return Object.entries(db.machines).filter(([, m]) => m.key === key);
    },
  };
}
