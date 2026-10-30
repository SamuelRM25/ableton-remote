import { useEffect, useState } from "react";
import { useAbleton } from "../lib/hooks";
import { useLiveRawList, useLiveChildProp } from "../lib/list-hooks";
import { colorToHex } from "../lib/color";
import { toast } from "../lib/toast";
import { EmptyPanel, LedKey, ViewStrip } from "../components/hw";

interface PadBinding {
  trackId: string;
  sceneIdx: number;
  /** Track name: Live's ids change on every restart, the name doesn't. */
  trackName?: string;
}

const STORAGE_KEY = "ableton-remote.pads.v1";
const COLS = 8;
const ROWS = 8;
const PADS = COLS * ROWS;

function loadBindings(): PadBinding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array(PADS).fill(null).map(() => ({ trackId: "", sceneIdx: -1 }));
    return JSON.parse(raw) as PadBinding[];
  } catch {
    return Array(PADS).fill(null).map(() => ({ trackId: "", sceneIdx: -1 }));
  }
}

function saveBindings(b: PadBinding[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    // private mode / storage full — bindings stay for this session only
  }
}

export function PadsView() {
  const modeSwitch = (
    <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.06em" }}>Pads</span>
  );
  return <FreePads modeSwitch={modeSwitch} />;
}

function FreePads({ modeSwitch }: { modeSwitch: React.ReactNode }) {
  const client = useAbleton();
  const rawTracks = useLiveRawList<any>("song", "tracks");
  const rawScenes = useLiveRawList<any>("song", "scenes");
  const [trackMap, setTrackMap] = useState<Map<string, any>>(new Map());
  const [bindings, setBindings] = useState<PadBinding[]>(loadBindings);
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!client || !rawTracks) return;
    let cancelled = false;
    (async () => {
      try {
        const tracks = await client.song.get("tracks");
        if (cancelled) return;
        const m = new Map<string, any>();
        for (const t of tracks) {
          m.set(t.raw.id, t);
          // Also index by name so bindings survive a Live restart.
          if (t.raw.name && !m.has(`name:${t.raw.name}`)) m.set(`name:${t.raw.name}`, t);
        }
        setTrackMap(m);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, rawTracks]);

  function setBinding(padIdx: number, b: PadBinding) {
    const next = [...bindings];
    next[padIdx] = b;
    setBindings(next);
    saveBindings(next);
  }

  async function firePad(padIdx: number) {
    if (!client) return;
    const b = bindings[padIdx];
    if (!b || !b.trackId || b.sceneIdx < 0) return;
    const track = resolveTrack(trackMap, b);
    if (!track) {
      toast("El track de este pad ya no existe");
      return;
    }
    try {
      const slots = await track.get("clip_slots");
      const slot = slots[b.sceneIdx];
      // Like Live: launches a clip, or records into the slot if armed.
      if (slot) await slot.fire();
    } catch {
      toast("No se pudo lanzar el pad");
    }
  }

  /** Fill every pad from the Session grid: 8 tracks × 8 scenes. */
  function autoMap() {
    const ids = (rawTracks ?? []).map((t: any) => String(t.id)).slice(0, COLS);
    const next: PadBinding[] = Array.from({ length: PADS }, (_, i) => {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const trackId = ids[col];
      const trackName = (rawTracks ?? []).find((t: any) => String(t.id) === trackId)?.name;
      return trackId && row < (rawScenes?.length ?? ROWS) ? { trackId, sceneIdx: row, trackName } : { trackId: "", sceneIdx: -1 };
    });
    setBindings(next);
    saveBindings(next);
    toast("Pads asignados desde la Session");
  }

  if (!client) {
    return <EmptyPanel title="Live no está conectado" hint="Abre Ableton Live con AbletonJS activo como Control Surface." />;
  }

  const bound = bindings.filter((b) => b.trackId).length;

  return (
    <div className="h-full flex flex-col">
      <ViewStrip>
        {modeSwitch}
        <span className="value-mono hidden md:inline" style={{ fontSize: 12, color: "var(--color-text-3)" }}>
          {bound} de {PADS} asignados
        </span>
        <div className="flex-1" />
        {editing && <LedKey size="sm" label="Auto 8×8" onClick={autoMap} title="Asignar las primeras 8 pistas × 8 escenas" />}
        <LedKey
          size="sm"
          variant="dot"
          color="cue"
          active={editing}
          label={editing ? "Listo" : "Asignar"}
          onClick={() => {
            setEditing((e) => !e);
            setSelected(null);
          }}
        />
      </ViewStrip>

      <div className="flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6">
        <div
          className="panel"
          style={{
            padding: "clamp(10px, 2vw, 18px)",
            width: "min(760px, 100%, calc(100vh - 290px))",
            minWidth: 280,
            borderRadius: 16,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: "clamp(4px, 1vw, 8px)",
              aspectRatio: "1 / 1",
            }}
          >
            {bindings.map((b, i) => {
              const track = b.trackId ? resolveTrack(trackMap, b) : null;
              return (
                <Pad
                  key={i}
                  index={i}
                  track={track}
                  sceneIdx={b.sceneIdx}
                  editing={editing}
                  selected={editing && selected === i}
                  onPress={() => {
                    if (editing) setSelected(i);
                    else void firePad(i);
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {editing && (
        <BindingPicker
          padIndex={selected}
          current={selected !== null ? bindings[selected] : null}
          tracks={(rawTracks ?? []).map((t: any) => ({ id: String(t.id), name: t.name || "—" }))}
          sceneCount={rawScenes?.length ?? 0}
          onBind={(b) => {
            if (selected === null) return;
            const trackName = (rawTracks ?? []).find((t: any) => String(t.id) === b.trackId)?.name;
            setBinding(selected, { ...b, trackName });
            setSelected(selected + 1 < PADS ? selected + 1 : null);
          }}
          onClear={() => selected !== null && setBinding(selected, { trackId: "", sceneIdx: -1 })}
        />
      )}
    </div>
  );
}

function resolveTrack(map: Map<string, any>, b: PadBinding): any | null {
  return map.get(b.trackId) ?? (b.trackName ? map.get(`name:${b.trackName}`) : null) ?? null;
}

function Pad({
  index,
  track,
  sceneIdx,
  onPress,
  editing,
  selected,
}: {
  index: number;
  track: any;
  sceneIdx: number;
  onPress: () => void;
  editing: boolean;
  selected: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const color = useLiveChildProp<number>(track, "color");
  const name = useLiveChildProp<string>(track, "name");
  const [slot, setSlot] = useState<any>(null);
  useEffect(() => {
    if (!track || sceneIdx < 0) {
      setSlot(null);
      return;
    }
    let cancelled = false;
    track
      .get("clip_slots")
      .then((slots: any[]) => !cancelled && setSlot(slots[sceneIdx] ?? null))
      .catch(() => !cancelled && setSlot(null));
    return () => {
      cancelled = true;
    };
  }, [track, sceneIdx]);

  const hasClip = useLiveChildProp<boolean>(slot, "has_clip");
  const [clip, setClip] = useState<any>(null);
  useEffect(() => {
    if (!slot || !hasClip) {
      setClip(null);
      return;
    }
    let cancelled = false;
    slot
      .get("clip")
      .then((c: any) => !cancelled && setClip(c))
      .catch(() => !cancelled && setClip(null));
    return () => {
      cancelled = true;
    };
  }, [slot, hasClip]);

  const clipColor = useLiveChildProp<number>(clip, "color", { pollMs: 2000 });
  const clipName = useLiveChildProp<string>(clip, "name", { pollMs: 2000 });
  const playingSlot = useLiveChildProp<number>(track, "playing_slot_index");
  const isPlaying = playingSlot === sceneIdx && sceneIdx >= 0;
  const isRecording = useLiveChildProp<boolean>(isPlaying ? clip : null, "is_recording", { pollMs: 400 });

  const bound = !!track && sceneIdx >= 0;
  const hex = colorToHex(clipColor) ?? colorToHex(color);
  const lit = !!isPlaying || !!isRecording;
  const tint = isRecording ? "#ff3b3b" : hex;

  // Silicone pad: dark when unbound, dimly backlit when bound,
  // fully lit (with bloom) while its clip plays.
  const background = !bound
    ? "radial-gradient(circle at 50% 35%, #2c2e33 0%, #1d1f23 80%)"
    : tint
      ? lit
        ? `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${tint} 55%, white) 0%, ${tint} 55%, color-mix(in srgb, ${tint} 75%, black) 100%)`
        : `radial-gradient(circle at 50% 40%, color-mix(in srgb, ${tint} ${hasClip ? 55 : 22}%, #2a2c31) 0%, color-mix(in srgb, ${tint} ${hasClip ? 32 : 12}%, #1b1c20) 100%)`
      : "radial-gradient(circle at 50% 35%, #34373d 0%, #222428 80%)";

  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onClick={onPress}
      aria-label={bound ? `Pad ${index + 1}: ${clipName ?? name ?? ""}` : `Pad ${index + 1} sin asignar`}
      style={{
        background,
        borderRadius: "clamp(5px, 1vw, 9px)",
        border: selected ? "2px solid var(--color-accent-cue)" : "1px solid rgba(0,0,0,0.7)",
        boxShadow: pressed
          ? "inset 0 3px 8px rgba(0,0,0,0.7)"
          : lit && tint
            ? `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 22px color-mix(in srgb, ${tint} 60%, transparent), 0 2px 4px rgba(0,0,0,0.6)`
            : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 3px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.55)",
        transform: pressed ? "scale(0.97)" : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "clamp(3px, 0.8vw, 7px)",
        cursor: "pointer",
        touchAction: "manipulation",
        position: "relative",
        overflow: "hidden",
        minWidth: 0,
        transition: "box-shadow 120ms var(--ease-instrument), background 120ms, transform 60ms",
      }}
    >
      <span className="value-mono" style={{ fontSize: 9, fontWeight: 700, color: lit ? "rgba(0,0,0,0.6)" : "rgba(233,229,218,0.35)" }}>
        {index + 1}
      </span>
      {bound && (
        <span
          className="truncate w-full text-left hidden sm:block"
          style={{ fontSize: 10, fontWeight: 700, color: lit ? "rgba(0,0,0,0.75)" : "rgba(233,229,218,0.75)" }}
        >
          {clipName ?? (editing ? `${name ?? "—"} · ${sceneIdx + 1}` : "")}
        </span>
      )}
    </button>
  );
}

function BindingPicker({
  padIndex,
  current,
  tracks,
  sceneCount,
  onBind,
  onClear,
}: {
  padIndex: number | null;
  current: PadBinding | null;
  tracks: { id: string; name: string }[];
  sceneCount: number;
  onBind: (b: PadBinding) => void;
  onClear: () => void;
}) {
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "");
  const [scene, setScene] = useState(1);

  useEffect(() => {
    if (current?.trackId) {
      setTrackId(current.trackId);
      setScene(current.sceneIdx + 1);
    }
  }, [current?.trackId, current?.sceneIdx]);

  useEffect(() => {
    if (tracks.length > 0 && !tracks.find((t) => t.id === trackId)) setTrackId(tracks[0].id);
  }, [tracks, trackId]);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 panel-raised"
      style={{ bottom: 116, padding: 14, zIndex: 20, maxWidth: "calc(100vw - 24px)", overflowX: "auto" }}
    >
      {padIndex === null ? (
        <span style={{ fontSize: 14, color: "var(--color-text-2)" }}>Toca un pad para asignarle un clip.</span>
      ) : (
        <div className="flex items-center gap-2.5 flex-wrap">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15 }}>Pad {padIndex + 1}</span>
          <label className="flex items-center gap-1.5">
            <span className="label-cap" style={{ fontSize: 10 }}>Track</span>
            <select
              value={trackId}
              onChange={(e) => setTrackId(e.target.value)}
              style={{ border: "1px solid rgba(0,0,0,0.6)", borderRadius: 6, padding: "7px 10px", fontSize: 14, maxWidth: 180 }}
            >
              {tracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="label-cap" style={{ fontSize: 10 }}>Escena</span>
            <select
              value={scene}
              onChange={(e) => setScene(Number(e.target.value))}
              style={{ border: "1px solid rgba(0,0,0,0.6)", borderRadius: 6, padding: "7px 10px", fontSize: 14 }}
            >
              {Array.from({ length: Math.max(1, sceneCount) }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <LedKey size="sm" color="play" active label="Asignar" onClick={() => trackId && onBind({ trackId, sceneIdx: scene - 1 })} />
          <LedKey size="sm" label="Vaciar" onClick={onClear} />
        </div>
      )}
    </div>
  );
}
