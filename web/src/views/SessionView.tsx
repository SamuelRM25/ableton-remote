import { useEffect, useMemo, useState } from "react";
import type { Ableton } from "ableton-js";
import { useAbleton } from "../lib/hooks";
import { useLiveRawList } from "../lib/list-hooks";
import { SessionGrid } from "../components/SessionGrid";
import { useViewport } from "../lib/viewport";
import { EmptyPanel, Led, LedKey, ViewStrip } from "../components/hw";

export function SessionView() {
  const client = useAbleton();
  const { isMobile } = useViewport();
  // Raw (serialized) lists: stable `.id` on every element.
  const rawTracks = useLiveRawList<any>("song", "tracks");
  const rawScenes = useLiveRawList<any>("song", "scenes");

  // Transformed Track instances (for method access)
  const [trackMap, setTrackMap] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    if (!client || !rawTracks) {
      setTrackMap(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const tracks = await client.song.get("tracks");
        if (cancelled) return;
        const m = new Map<string, any>();
        for (const t of tracks) {
          m.set(t.raw.id, t);
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

  const trackIds = useMemo(() => rawTracks?.map((t) => t.id) ?? [], [rawTracks]);
  const sceneCount = rawScenes?.length ?? 0;
  // Edit mode: taps delete clips/scenes instead of firing them.
  // You must enter it explicitly, so nothing gets deleted mid-performance.
  const [editMode, setEditMode] = useState(false);

  if (!client) {
    return <EmptyPanel title="Live no está conectado" hint="Abre Ableton Live con DAWRemote activo como Control Surface." />;
  }

  return (
    <div className="h-full flex flex-col">
      <SessionToolbar
        sceneCount={sceneCount}
        trackCount={trackIds.length}
        editMode={editMode}
        onToggleEdit={() => setEditMode((e) => !e)}
      />
      {editMode && (
        <div
          className="shrink-0 flex items-center justify-center gap-2"
          style={{
            padding: "7px 12px",
            background: "linear-gradient(180deg, rgba(255,77,106,0.18), rgba(255,77,106,0.08))",
            borderBottom: "1px solid rgba(255,77,106,0.5)",
            color: "var(--color-critical)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Led on color="critical" size={6} blink />
          Modo borrar: toca un clip o una scene para eliminarla de Live
        </div>
      )}
      <SessionGrid
        client={client}
        trackIds={trackIds}
        trackMap={trackMap}
        sceneCount={sceneCount}
        editMode={editMode}
        cellW={isMobile ? 84 : 108}
        cellH={isMobile ? 54 : 62}
        trackHeaderH={isMobile ? 104 : 110}
        sceneNameW={isMobile ? 132 : 160}
      />
    </div>
  );
}

function SessionToolbar({
  sceneCount,
  trackCount,
  editMode,
  onToggleEdit,
}: {
  sceneCount: number;
  trackCount: number;
  editMode: boolean;
  onToggleEdit: () => void;
}) {
  return (
    <ViewStrip>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.06em" }}>Session</span>
      <span className="value-mono" style={{ fontSize: 12, color: "var(--color-text-3)" }}>
        {trackCount} tracks · {sceneCount} scenes
      </span>
      <div className="flex-1" />
      <LedKey
        size="sm"
        variant="dot"
        color="critical"
        active={editMode}
        label={editMode ? "Listo" : "Borrar"}
        onClick={onToggleEdit}
        title="Modo borrar clips y scenes"
      />
    </ViewStrip>
  );
}
