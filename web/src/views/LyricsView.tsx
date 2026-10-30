import { useEffect, useState } from "react";
import { useAbleton } from "../lib/hooks";
import { useLiveRawList } from "../lib/list-hooks";
import { IconCheck, IconChevronLeft, IconChevronRight } from "../components/icons";

const STORAGE_KEY = "ableton-remote.lyrics.v1";

type LyricsMap = Record<string, string>;

function loadLyrics(): LyricsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LyricsMap;
  } catch {
    return {};
  }
}

function saveLyrics(map: LyricsMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function LyricsView() {
  const client = useAbleton();
  const cues = useLiveRawList<any>("song", "cue_points");
  const [lyrics, setLyrics] = useState<LyricsMap>(loadLyrics);
  const [activeIdx, setActiveIdx] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState("");

  const items = (cues ?? []).map((cp, i) => ({
    id: String(cp.id ?? i),
    name: cp.name || `Cue ${i + 1}`,
  }));

  useEffect(() => {
    if (items.length === 0) return;
    if (activeIdx >= items.length) setActiveIdx(0);
  }, [items.length, activeIdx]);

  const active = items[activeIdx];
  const text = active ? (lyrics[active.id] ?? "") : "";

  function handleEdit() {
    setDraft(text);
    setEditMode(true);
  }

  function handleSave() {
    if (!active) return;
    const next = { ...lyrics, [active.id]: draft };
    setLyrics(next);
    saveLyrics(next);
    setEditMode(false);
  }

  function handleCancel() {
    setEditMode(false);
  }

  function handleNext() {
    if (items.length === 0) return;
    setActiveIdx((i) => (i + 1) % items.length);
  }

  function handlePrev() {
    if (items.length === 0) return;
    setActiveIdx((i) => (i - 1 + items.length) % items.length);
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
          style={{ color: "var(--color-text-2)" }}
        >
          Lyrics
        </span>
        <button
          onClick={handlePrev}
          className="tactile"
          style={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-surface-2)",
            color: "var(--color-text-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
          }}
        >
          <IconChevronLeft size={16} />
        </button>
        <span
          className="truncate"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "var(--color-text-1)",
            letterSpacing: "-0.01em",
          }}
        >
          {active?.name ?? "—"}
        </span>
        <span
          className="value-mono"
          style={{ fontSize: 12, color: "var(--color-text-3)" }}
        >
          {activeIdx + 1} / {items.length}
        </span>
        <button
          onClick={handleNext}
          className="tactile"
          style={{
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-surface-2)",
            color: "var(--color-text-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
          }}
        >
          <IconChevronRight size={16} />
        </button>
        <div className="flex-1" />
        {editMode ? (
          <>
            <button
              onClick={handleSave}
              className="tactile"
              style={{
                height: 36,
                padding: "0 14px",
                background: "var(--color-accent-play)",
                color: "var(--color-text-inverse)",
                fontWeight: 600,
                fontSize: 13,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <IconCheck size={14} />
              Save
            </button>
            <button onClick={handleCancel} className="tactile" style={smallBtn}>
              Cancel
            </button>
          </>
        ) : (
          <button onClick={handleEdit} className="tactile" style={smallBtn}>
            Edit
          </button>
        )}
      </div>

      <div
        className="flex-1 min-h-0 overflow-auto"
        style={{ background: "var(--color-bg)" }}
      >
        {items.length === 0 ? (
          <Empty>Crea cue points en Live para añadir letras</Empty>
        ) : editMode ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
            placeholder="Escribe las letras aquí…"
            className="w-full h-full p-8"
            style={{
              background: "var(--color-bg)",
              color: "var(--color-text-1)",
              fontFamily: "var(--font-sans)",
              fontSize: 22,
              lineHeight: 1.6,
              border: "none",
              outline: "none",
              resize: "none",
            }}
          />
        ) : text ? (
          <div
            className="max-w-3xl mx-auto p-8"
            style={{
              fontSize: 28,
              lineHeight: 1.55,
              color: "var(--color-text-1)",
              fontWeight: 500,
              letterSpacing: "-0.005em",
              whiteSpace: "pre-wrap",
            }}
          >
            {text}
          </div>
        ) : (
          <Empty>Toca Edit para añadir letras a este cue</Empty>
        )}
      </div>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  background: "var(--color-surface-2)",
  color: "var(--color-text-1)",
  fontWeight: 600,
  fontSize: 12,
  border: "1px solid var(--color-border)",
  borderRadius: 8,
};

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="label-cap" style={{ color: "var(--color-text-3)" }}>
        {children}
      </span>
    </div>
  );
}
