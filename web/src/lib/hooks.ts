import { useEffect, useRef, useState } from "react";
import type { Ableton } from "ableton-js";
import { abletonStore } from "./ableton-store";
import { useStore } from "./store";

export function useAbleton(): Ableton | null {
  return useStore(abletonStore, (s) => s.client);
}

export function useConnectionStatus() {
  return useStore(abletonStore, (s) => s.status);
}

export function useSettings() {
  return useStore(abletonStore, (s) => s.settings);
}

export function useLatency(): number | null {
  return useStore(abletonStore, (s) => s.latencyMs);
}

/**
 * Props that Live's Python API provably does NOT expose a listener for
 * (verified via get_observable_properties against Live 12.0.2).
 * Pre-seeded so we never attempt add_listener for them — we go straight
 * to get-once / polling and keep Live's log clean.
 */
const KNOWN_NON_LISTENABLE = new Set<string>([
  "song:name",
  "scene:is_empty",
  "mixer-device:volume",
  "mixer-device:panning",
  "mixer-device:cue_volume",
]);

/** Session-learned non-listenable props (shared across all hook users). */
const failedListeners = new Set<string>(KNOWN_NON_LISTENABLE);

export interface LivePropOptions {
  /** Try addListener first (default true). Set false for poll-only props. */
  listen?: boolean;
  /** Fallback/primary polling interval in ms. 0 = no polling. */
  pollMs?: number;
}

/**
 * Subscribes to a property on a Live namespace.
 *
 *   const tempo = useLiveProp(client, c => c.song, "tempo");
 *   const name = useLiveProp(client, c => c.song, "name", { listen: false, pollMs: 2000 });
 *
 * Strategy: get() once immediately, then try addListener(). If the prop is
 * not listenable (Live raises), fall back to polling when pollMs > 0.
 * The effect only depends on `client` — the namespace getter and prop are
 * read via refs so re-renders never cause resubscribe storms.
 */
export function useLiveProp<TValue>(
  client: Ableton | null,
  namespace: (client: Ableton) => any,
  prop: string,
  opts?: LivePropOptions,
): TValue | undefined {
  const [value, setValue] = useState<TValue | undefined>(undefined);
  const ref = useRef({ namespace, prop, opts });
  ref.current = { namespace, prop, opts };
  // Skip re-renders when Live pushes an identical value (meters, polls).
  const valueRef = useRef<TValue | undefined>(undefined);
  const setIfChanged = (next: TValue | undefined) => {
    if (!Object.is(next, valueRef.current)) {
      valueRef.current = next;
      setValue(next);
    }
  };

  useEffect(() => {
    if (!client) {
      setIfChanged(undefined);
      return;
    }
    let cancelled = false;
    let off: (() => Promise<unknown>) | null = null;
    let timer: number | null = null;

    const { namespace: fn, prop: p, opts: o } = ref.current;
    const listen = o?.listen ?? true;
    const pollMs = o?.pollMs ?? 0;
    const ns = fn(client);
    if (!ns) {
      setIfChanged(undefined);
      return;
    }
    const key = `${ns.ns ?? "ns"}:${p}`;

    (async () => {
      try {
        const initial = await ns.get(p);
        if (!cancelled) setIfChanged(initial as TValue);
      } catch {
        // get failed (prop missing on this object) — leave undefined
      }
      if (cancelled) return;

      let listening = false;
      if (listen && !failedListeners.has(key)) {
        try {
          const unsub = await ns.addListener(p, (next: TValue) => {
            if (!cancelled) setIfChanged(next);
          });
          if (cancelled) {
            await unsub().catch(() => {});
          } else {
            off = unsub;
            listening = true;
          }
        } catch {
          failedListeners.add(key);
        }
      }
      if (!listening && pollMs > 0 && !cancelled) {
        timer = window.setInterval(async () => {
          try {
            const v = await ns.get(p);
            if (!cancelled) setIfChanged(v as TValue);
          } catch {
            // ignore transient read errors while polling
          }
        }, pollMs);
      }
    })();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      if (off) void off().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  return value;
}

/**
 * Optimistic local override for controlled widgets (faders, knobs) whose
 * Live prop has no listener. While the user drags, the widget shows the
 * drag value instantly; Live polls confirm it shortly after.
 */
export function useOptimistic<T>(
  liveValue: T | undefined,
  setLive: (v: T) => void,
): [T | undefined, (v: T) => void] {
  const [local, setLocal] = useState<T | null>(null);

  useEffect(() => {
    setLocal(null);
  }, [liveValue]);

  return [local ?? liveValue, (v: T) => {
    setLocal(v);
    try {
      setLive(v);
    } catch {
      // ignore — Live will confirm via poll or the error surfaces elsewhere
    }
  }];
}
