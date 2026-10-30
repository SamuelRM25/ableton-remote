import { useEffect, useMemo, useState } from "react";
import type { Ableton } from "ableton-js";
import { useAbleton } from "../lib/hooks";
import { useLiveRawList } from "../lib/list-hooks";
import { SessionGrid } from "../components/SessionGrid";
import { useViewport } from "../lib/viewport";

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
    return <EmptyState label="Sin conexión" />;
  }

  return (
    <div className="h-full flex flex-col">
      <SessionToolbar
        sceneCount={sceneCount}
        editMode={editMode}
        onToggleEdit={() => setEditMode((e) => !e)}
      />
      {editMode && (
        <div
          className="shrink-0 flex items-center justify-center label-cap"
          style={{
            padding: "6px 12px",
            background: "color-mix(in srgb, var(--color-critical) 14%, var(--color-surface-1))",
            borderBottom: "1px solid var(--color-critical)",
            color: "var(--color-critical)",
          }}
        >
          Modo borrar: toca un clip o una scene para eliminarla
        </div>
      )}
      <SessionGrid
        client={client}
        trackIds={trackIds}
        trackMap={trackMap}
        sceneCount={sceneCount}
        editMode={editMode}
        cellW={isMobile ? 78 : 96}
        cellH={isMobile ? 52 : 60}
        trackHeaderH={isMobile ? 100 : 112}
        sceneNameW={isMobile ? 100 : 124}
      />
    </div>
  );
}

function SessionToolbar({
  sceneCount,
  editMode,
  onToggleEdit,
}: {
  sceneCount: number;
  editMode: boolean;
  onToggleEdit: () => void;
}) {
  return (
    <div
      className="h-12 shrink-0 flex items-center px-3 sm:px-5 gap-3 sm:gap-4"
      style={{
        background: "var(--color-surface-1)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="label-cap">Tracks</span>
      </div>
      <button
        onClick={onToggleEdit}
        className="tactile"
        style={{
          height: 32,
          padding: "0 12px",
          fontSize: 12,
          fontWeight: 700,
          color: editMode ? "var(--color-text-inverse)" : "var(--color-critical)",
          background: editMode ? "var(--color-critical)" : "transparent",
          border: `1.5px solid ${editMode ? "var(--color-critical)" : "var(--color-border)"}`,
          borderRadius: 8,
        }}
      >
        {editMode ? "Listo" : "Borrar"}
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <span className="label-cap">Scenes</span>
        <span
          className="value-mono"
          style={{ fontSize: 13, color: "var(--color-text-1)" }}
        >
          {sceneCount}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center">
      <span
        className="label-cap"
        style={{ color: "var(--color-text-3)" }}
      >
        {label}
      </span>
    </div>
  );
}
