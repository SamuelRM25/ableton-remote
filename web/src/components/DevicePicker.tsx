import { useEffect, useRef, useState } from "react";
import type { Ableton } from "ableton-js";
import { useLiveRawList } from "../lib/list-hooks";
import { toast } from "../lib/toast";

interface Chip {
  id: string;
  label: string;
  kind: "main" | "track" | "return";
}

/**
 * Track chips (MAIN + tracks + returns) + device list. Tapping a device
 * selects it in Live (song.appointed_device), which Macros/Device views
 * follow. The default track follows Live's own selection
 * (song.view.selected_track).
 */
export function DevicePicker({ client }: { client: Ableton }) {
  const rawTracks = useLiveRawList<any>("song", "tracks");
  const rawReturns = useLiveRawList<any>("song", "return_tracks");
  const [masterId, setMasterId] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [trackMap, setTrackMap] = useState<Map<string, any>>(new Map());
  const [devices, setDevices] = useState<any[]>([]);
  const [devicesVersion, setDevicesVersion] = useState(0);
  const [appointedId, setAppointedId] = useState<string | null>(null);
  // Two-tap delete: double-tap arms, tap executes.
  const [armingDevId, setArmingDevId] = useState<string | null>(null);
  const armTimer = useRef<number | null>(null);

  // Resolve the master id once per connection.
  useEffect(() => {
    if (!client) {
      setMasterId(null);
      return;
    }
    let cancelled = false;
    client.song
      .get("master_track")
      .then((t: any) => {
        if (!cancelled) setMasterId(t?.raw?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setMasterId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  // Default to Live's selected track.
  useEffect(() => {
    if (!client || trackId) return;
    let cancelled = false;
    (async () => {
      try {
        const sel: any = await client.song.view.get("selected_track");
        if (!cancelled && sel) setTrackId(sel.raw?.id ?? sel.id ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, trackId, rawTracks, rawReturns, masterId]);

  // Resolve transformed Track instances (tracks + returns + master) for device access.
  useEffect(() => {
    if (!client || !rawTracks) return;
    let cancelled = false;
    (async () => {
      try {
        const [tracks, returns, master] = await Promise.all([
          client.song.get("tracks"),
          client.song.get("return_tracks").catch(() => []),
          client.song.get("master_track").catch(() => null),
        ]);
        if (cancelled) return;
        const m = new Map<string, any>();
        for (const t of tracks ?? []) m.set(t.raw.id, t);
        for (const t of returns ?? []) m.set(t.raw.id, t);
        if (master?.raw?.id) m.set(master.raw.id, master);
        setTrackMap(m);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, rawTracks, rawReturns]);

  // Devices of the picked track.
  useEffect(() => {
    const track = trackId ? trackMap.get(trackId) : null;
    if (!track) {
      setDevices([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const devs = await track.get("devices");
        if (!cancelled) setDevices(devs ?? []);
      } catch {
        if (!cancelled) setDevices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trackMap, trackId, devicesVersion]);

  useEffect(
    () => () => {
      if (armTimer.current !== null) window.clearTimeout(armTimer.current);
    },
    [],
  );

  // Follow Live's appointed device for highlight.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    let off: (() => Promise<unknown>) | null = null;
    const sync = async () => {
      try {
        const dev = await client.song.get("appointed_device");
        if (!cancelled) setAppointedId(dev ? ((dev as any).nsid ?? (dev as any).raw?.id ?? null) : null);
      } catch {
        // ignore
      }
    };
    void sync();
    (async () => {
      try {
        off = await client.song.addListener("appointed_device", () => {
          void sync();
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      if (off) void off().catch(() => {});
    };
  }, [client]);

  async function selectDevice(dev: any) {
    const id = (dev as any).nsid ?? (dev as any).raw?.id;
    if (!id) {
      toast("No se pudo seleccionar el device");
      return;
    }
    try {
      await client.song.set("appointed_device", id);
    } catch {
      toast("No se pudo seleccionar el device");
    }
  }

  function armDelete(id: string) {
    setArmingDevId(id);
    if (armTimer.current !== null) window.clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => setArmingDevId(null), 3000);
  }

  async function deleteDevice(index: number, label: string) {
    const track = trackId ? trackMap.get(trackId) : null;
    if (!track) {
      toast("No se pudo borrar el device");
      return;
    }
    setArmingDevId(null);
    try {
      await track.sendCommand("delete_device", [index]);
      setDevicesVersion((v) => v + 1);
      toast(`Device borrado: ${label}`);
    } catch {
      toast("No se pudo borrar el device");
    }
  }

  const chips: Chip[] = [
    ...(masterId ? [{ id: masterId, label: "MAIN", kind: "main" as const }] : []),
    ...(rawTracks ?? []).map((t: any) => ({
      id: String(t.id),
      label: t.name || "—",
      kind: "track" as const,
    })),
    ...(rawReturns ?? []).map((t: any) => ({
      id: String(t.id),
      label: `↵ ${t.name || "—"}`,
      kind: "return" as const,
    })),
  ];
  if (chips.length === 0) return null;

  const activeTrackId = trackId ?? chips[0]?.id ?? null;

  return (
    <div
      className="shrink-0 flex flex-col gap-2 px-3 sm:px-5 py-2.5"
      style={{
        background: "var(--color-surface-1)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center gap-2 overflow-x-auto scroll-touch" style={{ touchAction: "pan-x" }}>
        <span className="label-cap shrink-0">Track</span>
        {chips.map((c) => {
          const active = c.id === activeTrackId;
          const accent =
            c.kind === "main"
              ? "var(--color-accent-play)"
              : c.kind === "return"
                ? "var(--color-accent-macro)"
                : "var(--color-accent-macro)";
          return (
            <button
              key={`${c.kind}-${c.id}`}
              onClick={() => setTrackId(c.id)}
              className="tactile shrink-0"
              style={{
                height: 32,
                padding: "0 12px",
                fontSize: 12,
                fontWeight: 600,
                color:
                  c.kind === "main" && !active
                    ? "var(--color-accent-play)"
                    : active
                      ? "var(--color-text-inverse)"
                      : "var(--color-text-1)",
                background: active ? accent : "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                maxWidth: 140,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      {devices.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto scroll-touch" style={{ touchAction: "pan-x" }}>
          <span className="label-cap shrink-0">Device</span>
          {devices.map((d: any, i: number) => {
            const id = (d as any).nsid ?? (d as any).raw?.id ?? i;
            const active = appointedId !== null && id === appointedId;
            const armed = armingDevId !== null && String(armingDevId) === String(id);
            const label = d.raw?.name ?? d.raw?.class_name ?? `Device ${i + 1}`;
            return (
              <button
                key={String(id)}
                onClick={() => {
                  if (armed) void deleteDevice(i, label);
                  else void selectDevice(d);
                }}
                onDoubleClick={() => armDelete(String(id))}
                title={armed ? "Toca de nuevo para borrar" : "Doble-tap para borrar"}
                className="tactile shrink-0"
                style={{
                  height: 32,
                  padding: "0 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: armed
                    ? "var(--color-text-inverse)"
                    : active
                      ? "var(--color-accent-macro)"
                      : "var(--color-text-2)",
                  background: armed
                    ? "var(--color-critical)"
                    : "var(--color-surface-2)",
                  border: `1.5px solid ${
                    armed
                      ? "var(--color-critical)"
                      : active
                        ? "var(--color-accent-macro)"
                        : "var(--color-border)"
                  }`,
                  borderRadius: 8,
                  maxWidth: 180,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {armed ? `¿Borrar ${label}?` : label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
