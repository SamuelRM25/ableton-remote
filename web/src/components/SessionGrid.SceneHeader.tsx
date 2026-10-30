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

  const colorHex = colorToHex(color) ?? "transparent";

  return (
    <button
      onClick={() => {
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
        void scene.fire();
      }}
      className="w-full h-full flex items-center px-3 gap-2"
      style={{
        background: editMode
          ? "color-mix(in srgb, var(--color-critical) 12%, transparent)"
          : "transparent",
        textAlign: "left",
        cursor: "pointer",
        opacity: isEmpty && !editMode ? 0.5 : 1,
        outline: editMode ? "2px dashed var(--color-critical)" : undefined,
        outlineOffset: -2,
      }}
    >
      <span
        className="w-1 self-stretch rounded-full"
        style={{ background: colorHex }}
      />
      <span
        className="value-mono"
        style={{
          fontSize: 10,
          color: "var(--color-text-3)",
          width: 18,
        }}
      >
        {String(sceneIdx + 1).padStart(2, "0")}
      </span>
      <span
        className="truncate"
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: "var(--color-text-1)",
        }}
      >
        {name || `Scene ${sceneIdx + 1}`}
      </span>
    </button>
  );
}
