import { useEffect, useState } from "react";
import { useAbleton } from "../lib/hooks";
import { useLiveRawList, useLiveChildProp } from "../lib/list-hooks";
import { colorToHex } from "../lib/color";

interface PadBinding {
  trackId: string;
  sceneIdx: number;
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
}

export function PadsView() {
  const client = useAbleton();
  const rawTracks = useLiveRawList<any>("song", "tracks");
  const [trackMap, setTrackMap] = useState<Map<string, any>>(new Map());
  const [bindings, setBindings] = useState<PadBinding[]>(loadBindings);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!client || !rawTracks) return;
    (async () => {
      try {
        const tracks = await client.song.get("tracks");
        const m = new Map<string, any>();
        for (const t of tracks) m.set(t.raw.id, t);
        setTrackMap(m);
      } catch {}
    })();
  }, [client, rawTracks]);

  function handleBind(padIdx: number, trackId: string, sceneIdx: number) {
    const next = [...bindings];
    next[padIdx] = { trackId, sceneIdx };
    setBindings(next);
    saveBindings(next);
  }

  async function firePad(padIdx: number) {
    if (!client) return;
    const b = bindings[padIdx];
    if (!b || !b.trackId || b.sceneIdx < 0) return;
    const track = trackMap.get(b.trackId);
    if (!track) return;
    try {
      const slots = await track.get("clip_slots");
      const slot = slots[b.sceneIdx];
      if (slot && (await slot.get("has_clip"))) {
        await slot.fire();
      }
    } catch {
      // ignore
    }
  }

  if (!client) return <Empty>Sin conexión</Empty>;

  return (
    <div className="h-full flex flex-col">
      <div
        className="h-14 shrink-0 flex items-center px-5 gap-4"
        style={{
          background: "var(--color-surface-1)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <span
          className="label-cap"
          style={{ color: "var(--color-accent-play)" }}
        >
          Performance pads
        </span>
        <span
          className="value-mono"
          style={{ fontSize: 12, color: "var(--color-text-3)" }}
        >
          {COLS}×{ROWS} · {bindings.filter((b) => b.trackId).length} bound
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setEditing((e) => !e)}
          className="tactile"
          style={{
            height: 36,
            padding: "0 14px",
            background: editing
              ? "var(--color-accent-cue)"
              : "var(--color-surface-2)",
            color: editing
              ? "var(--color-text-inverse)"
              : "var(--color-text-1)",
            fontWeight: 600,
            fontSize: 13,
            border: "1px solid var(--color-border)",
            borderRadius: 8,
          }}
        >
          {editing ? "Done" : "Edit bindings"}
        </button>
      </div>

      <div
        className="flex-1 min-h-0 flex items-center justify-center"
        style={{ background: "var(--color-bg)", padding: 24 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gap: 8,
            width: "min(720px, 100%)",
            aspectRatio: "1 / 1",
          }}
        >
          {bindings.map((b, i) => {
            const track = b.trackId ? trackMap.get(b.trackId) : null;
            return (
              <Pad
                key={i}
                index={i}
                track={track}
                sceneIdx={b.sceneIdx}
                onPress={() => !editing && firePad(i)}
                editing={editing}
              />
            );
          })}
        </div>
      </div>

      {editing && (
        <BindingPicker
          tracks={Array.from(trackMap.values())}
          onPick={(trackId, sceneIdx) => {
            // Assign to first unbound pad
            const idx = bindings.findIndex((b) => !b.trackId);
            if (idx === -1) return;
            handleBind(idx, trackId, sceneIdx);
          }}
        />
      )}
    </div>
  );
}

function Pad({
  index,
  track,
  sceneIdx,
  onPress,
  editing,
}: {
  index: number;
  track: any;
  sceneIdx: number;
  onPress: () => void;
  editing: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const color = useLiveChildProp<number>(track, "color");
  const name = useLiveChildProp<string>(track, "name");
  const [clip, setClip] = useState<any>(null);
  useEffect(() => {
    if (!track || sceneIdx < 0) {
      setClip(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const slots = await track.get("clip_slots");
        if (cancelled) return;
        const slot = slots[sceneIdx];
        if (slot && (await slot.get("has_clip"))) {
          const c = await slot.get("clip");
          if (!cancelled) setClip(c);
        } else {
          setClip(null);
        }
      } catch {
        setClip(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [track, sceneIdx]);

  const clipColor = useLiveChildProp<number>(clip, "color", { pollMs: 2000 });
  const clipName = useLiveChildProp<string>(clip, "name", { pollMs: 2000 });
  const isPlaying = useLiveChildProp<boolean>(clip, "is_playing", { pollMs: 500 });

  const baseColor = colorToHex(clipColor)
    ?? colorToHex(color)
    ?? "var(--color-surface-3)";

  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onPress}
      style={{
        background: pressed
          ? `color-mix(in srgb, ${baseColor} 80%, white)`
          : baseColor,
        borderRadius: 10,
        boxShadow: pressed
          ? "var(--shadow-inset-pressed)"
          : "var(--shadow-inset-soft)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        padding: 4,
        cursor: "pointer",
        touchAction: "manipulation",
        position: "relative",
        overflow: "hidden",
        transition: "background 60ms var(--ease-instrument)",
      }}
    >
      {isPlaying && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px solid var(--color-accent-play)",
            borderRadius: 10,
            boxShadow: "0 0 12px var(--color-accent-play)",
            pointerEvents: "none",
          }}
        />
      )}
      <span
        className="value-mono"
        style={{
          fontSize: 10,
          color: "rgba(0,0,0,0.5)",
          fontWeight: 700,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      {clipName && (
        <span
          className="truncate w-full text-center"
          style={{
            fontSize: 9,
            color: "rgba(0,0,0,0.7)",
            fontWeight: 600,
            padding: "0 4px",
          }}
        >
          {clipName}
        </span>
      )}
      {!clip && name && (
        <span
          className="truncate w-full text-center"
          style={{
            fontSize: 9,
            color: "rgba(255,255,255,0.7)",
            fontWeight: 600,
            padding: "0 4px",
          }}
        >
          {name}
        </span>
      )}
      {editing && !clip && (
        <span
          style={{
            fontSize: 16,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          +
        </span>
      )}
    </button>
  );
}

function BindingPicker({
  tracks,
  onPick,
}: {
  tracks: any[];
  onPick: (trackId: string, sceneIdx: number) => void;
}) {
  const [trackId, setTrackId] = useState(tracks[0]?.raw?.id ?? "");
  const [sceneIdx, setSceneIdx] = useState(0);

  useEffect(() => {
    if (tracks.length > 0 && !tracks.find((t) => t.raw.id === trackId)) {
      setTrackId(tracks[0].raw.id);
    }
  }, [tracks, trackId]);

  return (
    <div
      className="fixed bottom-32 left-1/2 -translate-x-1/2 panel-raised"
      style={{ padding: 16, zIndex: 20, maxWidth: "calc(100vw - 32px)", overflowX: "auto" }}
    >
      <div className="flex items-center gap-3">
        <span className="label-cap">Bind next pad:</span>
        <select
          value={trackId}
          onChange={(e) => setTrackId(e.target.value)}
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-1)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
            fontFamily: "var(--font-sans)",
          }}
        >
          {tracks.map((t) => (
            <option key={t.raw.id} value={t.raw.id}>
              {t.raw.name || "—"}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={63}
          value={sceneIdx}
          onChange={(e) => setSceneIdx(Number(e.target.value))}
          style={{
            width: 60,
            background: "var(--color-surface-2)",
            color: "var(--color-text-1)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            padding: "6px 10px",
            fontSize: 13,
            fontFamily: "var(--font-mono)",
            textAlign: "center",
          }}
        />
        <button
          onClick={() => trackId && onPick(trackId, sceneIdx)}
          className="tactile"
          style={{
            height: 32,
            padding: "0 14px",
            background: "var(--color-accent-play)",
            color: "var(--color-text-inverse)",
            fontWeight: 600,
            fontSize: 12,
            borderRadius: 6,
          }}
        >
          Bind
        </button>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="label-cap" style={{ color: "var(--color-text-3)" }}>
        {children}
      </span>
    </div>
  );
}
