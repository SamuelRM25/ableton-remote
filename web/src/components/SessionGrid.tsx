import type { Ableton } from "ableton-js";
import { TrackHeader } from "./SessionGrid.TrackHeader";
import { SceneHeader } from "./SessionGrid.SceneHeader";
import { ClipCell } from "./SessionGrid.ClipCell";

interface Props {
  client: Ableton;
  trackIds: string[];
  trackMap: Map<string, any>;
  sceneCount: number;
  cellW?: number;
  cellH?: number;
  trackHeaderH?: number;
  sceneNameW?: number;
  editMode?: boolean;
}

export function SessionGrid({
  client,
  trackIds,
  trackMap,
  sceneCount,
  cellW: CELL_W = 92,
  cellH: CELL_H = 60,
  trackHeaderH: TRACK_HEADER_H = 96,
  sceneNameW: SCENE_NAME_W = 124,
  editMode = false,
}: Props) {
  const cols = trackIds.length;
  const totalCols = cols + 1; // +1 for the scene name column on the right

  return (
    <div
      className="flex-1 min-h-0 overflow-auto scroll-touch"
      style={{ background: "#121316" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${CELL_W}px) ${SCENE_NAME_W}px`,
          gridTemplateRows: `${TRACK_HEADER_H}px repeat(${Math.max(1, sceneCount)}, ${CELL_H}px)`,
          width: "max-content",
        }}
      >
        {/* Row 0: Track headers (sticky top) */}
        {trackIds.map((id, idx) => {
          const track = trackMap.get(id);
          if (!track) return null;
          return (
            <div
              key={`th-${id}`}
              style={{
                position: "sticky",
                top: 0,
                zIndex: 3,
                background: "linear-gradient(180deg, #23252a, #1b1d21)",
                borderBottom: "1px solid rgba(0,0,0,0.85)",
                borderRight: "1px solid rgba(0,0,0,0.6)",
                boxShadow: "inset -1px 0 0 rgba(255,255,255,0.03), 0 4px 10px rgba(0,0,0,0.35)",
                height: TRACK_HEADER_H,
                gridRow: 1,
                gridColumn: idx + 1,
              }}
            >
              <TrackHeader client={client} track={track} index={idx} />
            </div>
          );
        })}

        {/* Row 0, last col: scene header label (sticky top + right) */}
        <div
          style={{
            position: "sticky",
            top: 0,
            right: 0,
            zIndex: 4,
            background: "linear-gradient(180deg, #23252a, #1b1d21)",
            borderBottom: "1px solid rgba(0,0,0,0.85)",
            borderLeft: "1px solid rgba(0,0,0,0.85)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
            height: TRACK_HEADER_H,
            gridRow: "1",
            gridColumn: totalCols,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 12,
          }}
        >
          <StopAllButton client={client} />
        </div>

        {/* Clip cells: each row is a scene */}
        {Array.from({ length: sceneCount }).map((_, sceneIdx) =>
          trackIds.map((trackId, trackIdx) => {
            const track = trackMap.get(trackId);
            if (!track) return null;
            return (
              <div
                key={`${trackId}-${sceneIdx}`}
                style={{
                  gridRow: sceneIdx + 2,
                  gridColumn: trackIdx + 1,
                  background: "transparent",
                }}
              >
                <ClipCell
                  client={client}
                  track={track}
                  sceneIdx={sceneIdx}
                  editMode={editMode}
                />
              </div>
            );
          }),
        )}

        {/* Scene name column (sticky right) */}
        {Array.from({ length: sceneCount }).map((_, sceneIdx) => (
          <div
            key={`sn-${sceneIdx}`}
            style={{
              position: "sticky",
              right: 0,
              zIndex: 2,
              background: "linear-gradient(90deg, #1b1d21, #202226)",
              borderLeft: "1px solid rgba(0,0,0,0.85)",
              boxShadow: "-6px 0 14px rgba(0,0,0,0.35)",
              gridColumn: totalCols,
              gridRow: sceneIdx + 2,
            }}
          >
            <SceneHeader client={client} sceneIdx={sceneIdx} editMode={editMode} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StopAllButton({ client }: { client: Ableton }) {
  return (
    <button
      onClick={() => void client.song.stopAllClips().catch(() => {})}
      className="tactile flex items-center gap-2"
      style={{ height: 32, padding: "0 12px" }}
      title="Parar todos los clips"
    >
      <span style={{ width: 9, height: 9, borderRadius: 1.5, background: "var(--color-accent-stop)", boxShadow: "0 0 6px var(--color-accent-stop)" }} />
      <span className="label-cap" style={{ fontSize: 10, color: "var(--color-text-2)" }}>Stop all</span>
    </button>
  );
}
