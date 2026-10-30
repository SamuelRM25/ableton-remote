import { useEffect, useState } from "react";
import type { Ableton } from "ableton-js";
import { useLiveChildProp } from "../lib/list-hooks";
import { toast } from "../lib/toast";
import { colorToHex } from "../lib/color";

interface Props {
  client: Ableton;
  sceneIdx: number;
  editMode?: boolean;
}

export function SceneHeader({ client, sceneIdx, editMode }: Props) {
  const [scene, setScene] = useState<any>(null);
  const [scenesVersion, setScenesVersion] = useState(0);

  // Re-fetch the Scene instance whenever the scenes list changes.
  useEffect(() => {
    let cancelled = false;
    let off: (() => Promise<unknown>) | null = null;
    (async () => {
      try {
        const all = await client.song.get("scenes");
        if (!cancelled) setScene(all[sceneIdx] ?? null);
      } catch {
        // ignore
      }
      try {
        off = await client.song.addListener("scenes", () => {
          if (!cancelled) setScenesVersion((v) => v + 1);
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      if (off) void off().catch(() => {});
    };
  }, [client, sceneIdx, scenesVersion]);

  const name = useLiveChildProp<string>(scene, "name");
  const color = useLiveChildProp<number>(scene, "color");
  // scene.is_empty has no listener in Live — poll slowly instead.
  const isEmpty = useLiveChildProp<boolean>(scene, "is_empty", {
    listen: false,
    pollMs: 2000,
  });

  const colorHex = colorToHex(color);

  function handle() {
    if (!scene) return;
    if (editMode) {
      void (async () => {
        try {
          await client.song.deleteScene(sceneIdx);
          toast("Scene borrada");
        } catch {
          toast("No se pudo borrar la scene");
        }
      })();
      return;
    }
    void scene.fire().catch(() => toast("No se pudo lanzar la scene"));
  }

  return (
    <button
      onClick={handle}
      className="w-full h-full flex items-center gap-2"
      style={{
        padding: "0 8px 0 6px",
        textAlign: "left",
        background: editMode ? "rgba(255,77,106,0.12)" : "transparent",
        outline: editMode ? "2px dashed var(--color-critical)" : undefined,
        outlineOffset: -3,
      }}
      aria-label={`Lanzar scene ${sceneIdx + 1}`}
    >
      {/* launch key */}
      <span
        className="tactile shrink-0 flex items-center justify-center"
        style={{ width: 30, height: 30, borderRadius: 6 }}
      >
        <svg width="10" height="11" viewBox="0 0 10 11" aria-hidden>
          <path
            d="M1 0.5 L9.5 5.5 L1 10.5Z"
            fill={isEmpty ? "var(--color-text-3)" : "var(--color-accent-play)"}
            style={{ filter: isEmpty ? undefined : "drop-shadow(0 0 3px var(--color-accent-play))" }}
          />
        </svg>
      </span>
      <span
        aria-hidden
        className="shrink-0"
        style={{
          width: 3,
          alignSelf: "stretch",
          margin: "12px 0",
          borderRadius: 2,
          background: colorHex ?? "transparent",
        }}
      />
      <span className="flex flex-col min-w-0" style={{ opacity: isEmpty && !editMode ? 0.55 : 1 }}>
        <span className="value-mono" style={{ fontSize: 9, color: "var(--color-text-3)" }}>
          {sceneIdx + 1}
        </span>
        <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-1)" }}>
          {name || `Scene ${sceneIdx + 1}`}
        </span>
      </span>
    </button>
  );
}
