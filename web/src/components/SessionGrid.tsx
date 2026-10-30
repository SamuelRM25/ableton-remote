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
  const totalRows = sceneCount + 1; // +1 for the track header row on top

  return (
    <div
      className="flex-1 min-h-0 overflow-auto"
      style={{ background: "var(--color-bg)" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${CELL_W}px) ${SCENE_NAME_W}px`,
          gridAutoRows: `${CELL_H}px`,
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
                background: "var(--color-surface-1)",
                borderBottom: "1px solid var(--color-border)",
                borderRight: "1px solid var(--color-border)",
                height: TRACK_HEADER_H,
                gridRow: "1",
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
            background: "var(--color-surface-1)",
            borderBottom: "1px solid var(--color-border)",
            borderLeft: "1px solid var(--color-border)",
            height: TRACK_HEADER_H,
            gridRow: "1",
            gridColumn: totalCols,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            paddingBottom: 12,
          }}
        >
          <span
            className="label-cap"
            style={{ color: "var(--color-text-3)" }}
          >
            Scene
          </span>
        </div>

        {/* Clip cells: each row is a scene */}
        {Array.from({ length: sceneCount }).map((_, sceneIdx) =>
          trackIds.map((trackId, trackIdx) => {
            const track = trackMap.get(trackId);
            if (!track) return null;
            const isLastCol = trackIdx === trackIds.length - 1;
            return (
              <div
                key={`${trackId}-${sceneIdx}`}
                style={{
                  borderRight: isLastCol
                    ? "1px solid var(--color-border)"
                    : undefined,
                  borderBottom: "1px solid var(--color-border)",
                  background: "var(--color-surface-1)",
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
              background: "var(--color-surface-1)",
              borderLeft: "1px solid var(--color-border)",
              borderBottom: "1px solid var(--color-border)",
              gridColumn: totalCols,
            }}
          >
            <SceneHeader client={client} sceneIdx={sceneIdx} editMode={editMode} />
          </div>
        ))}
      </div>
    </div>
  );
}
