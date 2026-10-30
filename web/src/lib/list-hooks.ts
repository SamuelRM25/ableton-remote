import { useEffect, useRef, useState } from "react";
import type { Ableton } from "ableton-js";
import { useAbleton } from "./hooks";
import type { LivePropOptions } from "./hooks";

/** See lib/hooks.ts — shared session knowledge of non-listenable props. */
const KNOWN_NON_LISTENABLE = new Set<string>([
  "song:name",
  "scene:is_empty",
  "mixer-device:volume",
  "mixer-device:panning",
  "mixer-device:cue_volume",
]);

const failedListeners = new Set<string>(KNOWN_NON_LISTENABLE);

/**
 * Subscribes to an array property (e.g. song.tracks, song.scenes).
 * Effect depends only on client — the namespace getter is read via ref,
 * so re-renders never cause resubscribe storms.
 */
export function useLiveList<T = any>(
  ns: ((client: Ableton) => any) | null,
  prop: string | null,
): T[] | null {
  const client = useAbleton();
  const [list, setList] = useState<T[] | null>(null);
  const ref = useRef({ ns, prop });
  ref.current = { ns, prop };

  useEffect(() => {
    if (!client) {
      setList(null);
      return;
    }
    const { ns: fn, prop: p } = ref.current;
    if (!fn || !p) {
      setList(null);
      return;
    }
    let cancelled = false;
    let off: (() => Promise<unknown>) | null = null;
    const target = fn(client);

    (async () => {
      try {
        const initial = await target.get(p);
        if (!cancelled) setList(initial as T[]);
      } catch {
        // ignore
      }
      if (cancelled) return;
      try {
        const unsub = await target.addListener(p, (next: T[]) => {
          if (!cancelled) setList(next as T[]);
        });
        if (cancelled) {
          await unsub().catch(() => {});
        } else {
          off = unsub;
        }
      } catch {
        // list prop not listenable — keep the snapshot from get()
      }
    })();

    return () => {
      cancelled = true;
      if (off) void off().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  return list;
}

/**
 * Subscribes to an array property and always returns RAW (serialized)
 * objects with stable `.id` fields — no client-side transformers.
 * Uses client.getProp directly + re-fetches on every listener push
 * (list changes are rare, so freshness beats payload cleverness).
 */
export function useLiveRawList<T = any>(
  nsName: string | null,
  prop: string | null,
): T[] | null {
  const client = useAbleton();
  const [list, setList] = useState<T[] | null>(null);
  const ref = useRef({ nsName, prop });
  ref.current = { nsName, prop };
  const sigRef = useRef<string | null>(null);
  const setIfChanged = (next: T[] | null) => {
    const sig = next === null ? null : next.map((t: any) => t?.id ?? t?.nsid ?? "").join("|");
    if (sig !== sigRef.current) {
      sigRef.current = sig;
      setList(next);
    }
  };

  useEffect(() => {
    if (!client) {
      setIfChanged(null);
      return;
    }
    const { nsName: ns, prop: p } = ref.current;
    if (!ns || !p) {
      setIfChanged(null);
      return;
    }
    let cancelled = false;
    let off: (() => Promise<unknown>) | null = null;

    const fetchAll = async () => {
      try {
        const raw = await client.getProp(ns, undefined, p);
        if (!cancelled && Array.isArray(raw)) setIfChanged(raw as T[]);
      } catch {
        // ignore
      }
    };

    (async () => {
      await fetchAll();
      if (cancelled) return;
      try {
        const target = (client as any)[ns] ?? null;
        if (!target || typeof target.addListener !== "function") return;
        const unsub = await target.addListener(p, () => {
          if (!cancelled) void fetchAll();
        });
        if (cancelled) {
          await unsub().catch(() => {});
        } else {
          off = unsub;
        }
      } catch {
        // not listenable — snapshot from the initial fetch stands
      }
    })();

    return () => {
      cancelled = true;
      if (off) void off().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  return list;
}

/**
 * Subscribes to a single property of an already-resolved Live namespace
 * object (track, clip, scene, device, parameter…).
 *
 * Unlike useLiveProp, the namespace object is passed directly, so this
 * hook legitimately resubscribes when the object identity changes (e.g.
 * a new Track instance after the track list refreshes).
 */
export function useLiveChildProp<T = any>(
  ns: any,
  prop: string,
  opts?: LivePropOptions,
): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const ref = useRef({ prop, opts });
  ref.current = { prop, opts };
  const valueRef = useRef<T | undefined>(undefined);
  const setIfChanged = (next: T | undefined) => {
    const sig = Array.isArray(next)
      ? next.map((t: any) => t?.id ?? t?.nsid ?? "").join("|")
      : next;
    const prev = valueRef.current;
    const prevSig = Array.isArray(prev)
      ? prev.map((t: any) => t?.id ?? t?.nsid ?? "").join("|")
      : prev;
    if (!Object.is(sig, prevSig)) {
      valueRef.current = next;
      setValue(next);
    }
  };

  useEffect(() => {
    if (!ns) {
      setIfChanged(undefined);
      return;
    }
    let cancelled = false;
    let off: (() => Promise<unknown>) | null = null;
    let timer: number | null = null;

    const { prop: p, opts: o } = ref.current;
    const listen = o?.listen ?? true;
    const pollMs = o?.pollMs ?? 0;
    const key = `${ns.ns ?? "ns"}:${p}`;

    (async () => {
      try {
        const initial = await ns.get(p);
        if (!cancelled) setIfChanged(initial as T);
      } catch {
        // ignore
      }
      if (cancelled) return;

      let listening = false;
      if (listen && !failedListeners.has(key)) {
        try {
          const unsub = await ns.addListener(p, (next: T) => {
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
            if (!cancelled) setIfChanged(v as T);
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
  }, [ns, prop]);

  return value;
}

/**
 * Resolves a track's MixerDevice namespace object.
 * (Direct `track.mixer_device` property access does not exist on the
 * ableton-js client — the mixer must be fetched via get().)
 */
export function useMixerDevice(track: any): any | null {
  const [mixer, setMixer] = useState<any>(null);

  useEffect(() => {
    if (!track) {
      setMixer(null);
      return;
    }
    let cancelled = false;
    track
      .get("mixer_device")
      .then((m: any) => {
        if (!cancelled) setMixer(m);
      })
      .catch(() => {
        if (!cancelled) setMixer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [track]);

  return mixer;
}

/**
 * Resolves a mixer's sends (DeviceParameter list). The sends array itself
 * is listenable; each send's `value` is listenable too.
 */
export function useSends(mixer: any): any[] | null {
  const sends = useLiveChildProp<any[]>(mixer, "sends");
  return sends ?? null;
}

/**
 * Reads a mixer parameter (volume/panning/…) as a NUMBER plus setter.
 *
 * Why this exists: ableton-js transforms some mixer props into
 * DeviceParameter instances (panning, sends…) but leaves others
 * (volume) as raw {value,…} objects. This hook normalizes both shapes
 * to [value, setValue], subscribing to the parameter's listenable
 * `value` with polling as backup.
 */
export function useMixerParam(
  mixer: any,
  prop: string,
  pollMs = 1000,
): readonly [number | undefined, (v: number) => void] {
  const client = useAbleton();
  // Normalized to the raw parameter id when the mixer returns a plain
  // object (volume), or the DeviceParameter instance when transformed.
  const [paramId, setParamId] = useState<string | null>(null);
  const [paramInstance, setParamInstance] = useState<any>(null);

  useEffect(() => {
    if (!mixer || !client) {
      setParamId(null);
      setParamInstance(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const p = await mixer.get(prop);
        if (cancelled) return;
        if (p && typeof p.get === "function") {
          setParamInstance(p);
          setParamId(null);
        } else if (p && typeof p.value === "number" && p.id) {
          setParamInstance(null);
          setParamId(String(p.id));
        } else {
          setParamInstance(null);
          setParamId(null);
        }
      } catch {
        if (!cancelled) {
          setParamInstance(null);
          setParamId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mixer, prop, client]);

  const [value, setValue] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!client) {
      setValue(undefined);
      return;
    }
    let cancelled = false;
    let off: (() => Promise<unknown>) | null = null;
    let timer: number | null = null;

    (async () => {
      const read = async (): Promise<number | undefined> => {
        try {
          if (paramInstance) return (await paramInstance.get("value")) as number;
          if (paramId) return (await client.getProp("device-parameter", paramId, "value")) as number;
          return undefined;
        } catch {
          return undefined;
        }
      };
      const initial = await read();
      if (!cancelled && initial !== undefined) setValue(initial);

      const onUpdate = (next: number) => {
        if (!cancelled) setValue(next);
      };
      try {
        if (paramInstance) {
          const unsub = await paramInstance.addListener("value", onUpdate);
          off = unsub;
        } else if (paramId) {
          const unsub = await client.addPropListener(
            "device-parameter",
            paramId,
            "value",
            onUpdate,
          );
          off = unsub;
        }
      } catch {
        // not listenable — polling below covers it
      }
      if (pollMs > 0) {
        timer = window.setInterval(async () => {
          const v = await read();
          if (!cancelled && v !== undefined) setValue(v);
        }, pollMs);
      }
    })();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      if (off) void off().catch(() => {});
    };
  }, [client, paramInstance, paramId, pollMs]);

  const set = (v: number) => {
    if (!client) return;
    try {
      if (paramInstance) void paramInstance.set("value", v).catch(() => {});
      else if (paramId) void client.setProp("device-parameter", paramId, "value", v).catch(() => {});
    } catch {
      // ignore
    }
  };
  return [value, set] as const;
}
