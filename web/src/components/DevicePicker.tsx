import { useEffect, useRef, useState } from "react";
import type { Ableton } from "ableton-js";
import { useLiveRawList } from "../lib/list-hooks";
import { toast } from "../lib/toast";
import { LedKey } from "./hw";

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
        background: "linear-gradient(180deg, #1d1f23, #18191d)",
        borderBottom: "1px solid rgba(0,0,0,0.75)",
      }}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto scroll-touch" style={{ touchAction: "pan-x", paddingBottom: 2 }}>
        <span className="label-cap shrink-0" style={{ width: 52 }}>Track</span>
        {chips.map((c) => (
          <LedKey
            key={`${c.kind}-${c.id}`}
            size="sm"
            variant="ring"
            color={c.kind === "main" ? "play" : c.kind === "return" ? "macro" : "cue"}
            active={c.id === activeTrackId}
            onClick={() => setTrackId(c.id)}
            label={c.label}
            style={{ maxWidth: 160, textTransform: "none", letterSpacing: "0.02em", fontSize: 13 }}
          />
        ))}
      </div>
      {devices.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto scroll-touch" style={{ touchAction: "pan-x", paddingBottom: 2 }}>
          <span className="label-cap shrink-0" style={{ width: 52 }}>Device</span>
          {devices.map((d: any, i: number) => {
            const id = (d as any).nsid ?? (d as any).raw?.id ?? i;
            const active = appointedId !== null && id === appointedId;
            const armed = armingDevId !== null && String(armingDevId) === String(id);
            const label = d.raw?.name ?? d.raw?.class_name ?? `Device ${i + 1}`;
            return (
              <span key={String(id)} onDoubleClick={() => armDelete(String(id))} className="shrink-0 flex">
                <LedKey
                  size="sm"
                  variant={armed ? "fill" : "dot"}
                  color={armed ? "critical" : "macro"}
                  active={armed || active}
                  onClick={() => {
                    if (armed) void deleteDevice(i, label);
                    else void selectDevice(d);
                  }}
                  title={armed ? "Toca de nuevo para borrar" : "Doble toque para borrar"}
                  label={armed ? `¿Borrar ${label}?` : label}
                  height={38}
                  style={{ maxWidth: 200, textTransform: "none", letterSpacing: "0.02em", fontSize: 13 }}
                />
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
