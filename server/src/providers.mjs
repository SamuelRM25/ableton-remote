import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A provider checks licence keys with whoever sold them.
 *   activate(key, machine) → { plan, email, until, instanceId, seats }
 *   validate(key, instanceId) → same shape, or { revoked: true, reason }
 *   deactivate(key, instanceId)
 * Errors are thrown as LicenseProblem with a message for the musician.
 */
export class LicenseProblem extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const toUnix = (iso) => (iso ? Math.floor(Date.parse(iso) / 1000) : null);

/** Plan from the Lemon Squeezy variant: explicit map first, then its name. */
function planFor(meta, planMap) {
  const byId = planMap[String(meta?.variant_id)];
  if (byId) return byId;
  const name = `${meta?.variant_name || ""} ${meta?.product_name || ""}`.toLowerCase();
  if (/fundador|founder/.test(name)) return "founder";
  if (/vida|lifetime|perpetu/.test(name)) return "lifetime";
  if (/anual|annual|year|año/.test(name)) return "annual";
  if (/mensual|month|mes/.test(name)) return "monthly";
  return "lifetime";
}

/** https://docs.lemonsqueezy.com/api/license-api — no API key needed. */
export function lemonSqueezy({ planMap = {}, storeId = null, fetchImpl = fetch } = {}) {
  async function call(path, params) {
    let res;
    try {
      res = await fetchImpl(`https://api.lemonsqueezy.com/v1/licenses/${path}`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
      });
    } catch {
      throw new LicenseProblem("No se pudo contactar al sistema de pagos. Intenta de nuevo.", 502);
    }
    const body = await res.json().catch(() => ({}));
    if (storeId && body?.meta?.store_id && String(body.meta.store_id) !== String(storeId)) {
      throw new LicenseProblem("Esa clave no es de DAW Remote.", 403);
    }
    return body;
  }
  const shape = (body) => ({
    plan: planFor(body.meta, planMap),
    email: body.meta?.customer_email || null,
    until: toUnix(body.license_key?.expires_at),
    seats: body.license_key?.activation_limit ?? null,
    status: body.license_key?.status,
  });
  return {
    name: "lemonsqueezy",
    async activate(key, machine) {
      const body = await call("activate", { license_key: key, instance_name: `${machine.name} (${machine.id.slice(0, 8)})` });
      if (!body.activated) throw new LicenseProblem(body.error || "No se pudo activar la clave.", 403);
      return { ...shape(body), instanceId: body.instance?.id };
    },
    async validate(key, instanceId) {
      const body = await call("validate", { license_key: key, instance_id: instanceId });
      if (!body.valid || !["active", "inactive"].includes(body.license_key?.status)) {
        return { revoked: true, reason: body.error || `Licencia ${body.license_key?.status || "no válida"}` };
      }
      return shape(body);
    },
    async deactivate(key, instanceId) {
      await call("deactivate", { license_key: key, instance_id: instanceId });
    },
  };
}

/**
 * Development / owner keys from data/dev-keys.json:
 *   { "DAWR-OWNER-XXXX": { "plan": "owner", "email": "…", "seats": 3, "until": null } }
 */
export function devKeys(dataDir) {
  const load = () => {
    const f = join(dataDir, "dev-keys.json");
    return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
  };
  return {
    name: "dev",
    async activate(key) {
      const k = load()[key];
      if (!k) throw new LicenseProblem("Esa clave no existe.", 403);
      return { plan: k.plan || "lifetime", email: k.email || null, until: k.until ?? null, seats: k.seats ?? 2, instanceId: `dev-${Date.now()}` };
    },
    async validate(key) {
      const k = load()[key];
      if (!k || k.revoked) return { revoked: true, reason: "Licencia desactivada" };
      return { plan: k.plan || "lifetime", email: k.email || null, until: k.until ?? null, seats: k.seats ?? 2 };
    },
    async deactivate() {},
  };
}
