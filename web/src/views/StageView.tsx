/**
 * Stage view: what the band needs to read from across the stage.
 * Current song, the part that is playing, what comes next, and the beat.
 *
 * Source of truth, in order:
 *   1. The song/parts tracks configured in the "Canción" view.
 *   2. Otherwise, the arrangement's cue points (locators) around the playhead.
 *
 * Open http://<mac>:39031/#escenario on a second device to get only this
 * screen, full size, with no navigation.
 */
import { useAbleton, useConnectionStatus, useLiveProp } from "../lib/hooks";
import { useSongClock } from "../lib/clock";
import { useLiveRawList } from "../lib/list-hooks";
import { useSongStructure } from "../lib/song-structure";
import { colorToHex } from "../lib/color";
import { FitText } from "../components/FitText";

export function StageView({ standalone }: { standalone?: boolean }) {
  const client = useAbleton();
  const status = useConnectionStatus();
  const clock = useSongClock(client);
  const st = useSongStructure(client);
  const cues = useLiveRawList<any>("song", "cue_points");
  const projectName = useLiveProp<string>(client, (c) => c.song, "name", { listen: false, pollMs: 4000 });

  // ---- what to show -------------------------------------------------
  let title = "";
  let now = "";
  let next = "";
  let nowColor: string | undefined;
  let nextIsQueued = false;
  let barsLeft: number | null = null;

  const barQ = (clock.beatsPerBar * 4) / clock.beatUnit;

  const setIdx = st.song ? st.setSongs.findIndex((x) => x.key === st.song!.key) : -1;

  if (st.configured && st.song) {
    title = st.song.name;
    const playing = st.currentPart;
    now = playing?.name ?? "";
    nowColor = colorToHex(playing?.color ?? st.song.color);
    if (st.queuedPart) {
      next = st.queuedPart.name;
      nextIsQueued = true;
    } else if (st.nextPart) {
      next = st.nextPart.name;
    } else if (!playing && st.songParts[0]) {
      next = st.songParts[0].name;
    } else if (playing && st.nextSong) {
      next = `→ ${st.nextSong.name}`;
    }
    // Arrangement clips have an end: count the bars left in this part.
    if (playing?.end !== undefined && clock.isPlaying) {
      barsLeft = Math.max(0, Math.ceil((playing.end - clock.beats) / barQ - 1e-6));
    }
  } else if (cues && cues.length > 0) {
    const sorted = [...cues].sort((a, b) => Number(a.time) - Number(b.time));
    const pos = clock.beats + 0.001;
    let idx = -1;
    sorted.forEach((c, i) => {
      if (Number(c.time) <= pos) idx = i;
    });
    const cur = idx >= 0 ? sorted[idx] : null;
    const nxt = sorted[idx + 1] ?? null;
    now = cur ? String(cur.name || `Marca ${idx + 1}`) : "";
    next = nxt ? String(nxt.name || `Marca ${idx + 2}`) : "";
    if (nxt) barsLeft = Math.max(0, Math.ceil((Number(nxt.time) - clock.beats) / barQ - 1e-6));
    title = projectName || "Arreglo";
  }

  const beat = clock.beat; // 1-based beat inside the bar
  const beatsInBar = Math.max(1, Math.min(16, clock.beatsPerBar));
  const accent = nowColor ?? "var(--color-vfd-ink)";

  const display: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    letterSpacing: "-0.005em",
    color: "var(--color-text-1)",
  };

  return (
    <div
      className="h-full w-full flex flex-col"
      style={{
        position: "relative",
        padding: "clamp(10px, min(3vw, 3vh), 32px)",
        gap: "clamp(8px, 2vh, 24px)",
        background: "radial-gradient(120% 90% at 50% 0%, #1a1712 0%, #0b0c0e 70%)",
      }}
    >
      {/* Top line: song + position/tempo */}
      <div className="flex items-stretch gap-3 sm:gap-4 shrink-0" style={{ height: "clamp(64px, 15vh, 150px)" }}>
        <div className="flex-1 min-w-0 flex flex-col">
          <div style={stageLabel}>
            {st.configured && st.song ? (st.activeSetlist && setIdx >= 0 ? `Canción ${setIdx + 1} de ${st.setSongs.length}` : "Canción") : "Proyecto"}
          </div>
          <div className="flex-1 min-h-0">
            <FitText max={110} min={16} lineHeight={1.02} style={display}>
              {status.kind !== "connected" ? "Esperando a Live…" : title || "—"}
            </FitText>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="vfd flex items-end gap-4 sm:gap-5" style={{ padding: "clamp(6px, 1.2vh, 12px) clamp(10px, 1.6vw, 18px)" }}>
            <div>
              <div className="seg" style={{ fontSize: "clamp(22px, min(4vw, 6vh), 44px)", lineHeight: 1 }}>
                {clock.barsDisplay.split(".").slice(0, 2).join(".")}
              </div>
              <div style={vfdCaption}>Compás</div>
            </div>
            <div>
              <div className="seg" style={{ fontSize: "clamp(18px, min(3vw, 4.5vh), 32px)", lineHeight: 1 }}>
                {clock.tempo.toFixed(0)}
              </div>
              <div style={vfdCaption}>BPM · {clock.signatureDisplay}</div>
            </div>
          </div>
          {!standalone && (
            <a
              href="#escenario"
              className="tactile label-cap"
              style={{ padding: "7px 10px", fontSize: 10, color: "var(--color-text-2)", textDecoration: "none" }}
              title="Solo esta pantalla. En otro iPad o teléfono abre la misma dirección terminada en #escenario"
            >
              Pantalla completa
            </a>
          )}
        </div>
      </div>

      {/* NOW */}
      <div
        className="flex-1 min-h-0 flex flex-col"
        style={{
          borderRadius: 24,
          padding: "clamp(10px, min(3vw, 3.5vh), 36px)",
          background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 22%, #15161a), color-mix(in srgb, ${accent} 8%, #0f1013))`,
          boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${accent} 55%, transparent), 0 0 60px color-mix(in srgb, ${accent} 18%, transparent)`,
        }}
      >
        <div style={{ ...stageLabel, color: accent }}>Ahora</div>
        <div className="flex-1 min-h-0">
          <FitText max={260} min={22} lineHeight={0.95} style={display}>
            {now || (clock.isPlaying ? "…" : "Parado")}
          </FitText>
        </div>

        {/* Beat lights */}
        <div className="flex items-center gap-3 shrink-0" style={{ marginTop: "clamp(8px, 2.5vh, 28px)" }} aria-label={`Tiempo ${beat} de ${beatsInBar}`}>
          {Array.from({ length: beatsInBar }).map((_, i) => {
            const on = clock.isPlaying && i + 1 === beat;
            const down = i === 0;
            const c = down ? "var(--color-accent-rec)" : "var(--color-accent-cue)";
            return (
              <span
                key={i}
                style={{
                  width: "clamp(14px, min(4vw, 5.5vh), 44px)",
                  height: "clamp(14px, min(4vw, 5.5vh), 44px)",
                  borderRadius: "50%",
                  background: on ? c : "rgba(255,255,255,0.06)",
                  boxShadow: on ? `0 0 24px ${c}, 0 0 6px ${c}` : "inset 0 2px 4px rgba(0,0,0,0.6)",
                  transition: "background 40ms, box-shadow 40ms",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* NEXT */}
      <div
        className="flex items-center gap-4 sm:gap-5 shrink-0"
        style={{
          height: "clamp(64px, 17vh, 170px)",
          borderRadius: 18,
          padding: "clamp(8px, 1.6vh, 20px) clamp(14px, 2.6vw, 30px)",
          background: "#141519",
          boxShadow: nextIsQueued ? "inset 0 0 0 2px var(--color-accent-cue)" : "inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ ...stageLabel, color: nextIsQueued ? "var(--color-accent-cue)" : undefined, marginBottom: 0 }} className={`shrink-0 ${nextIsQueued ? "beat-dot" : ""}`}>
          {nextIsQueued ? "Entra" : "Sigue"}
        </div>
        <div className="flex-1 min-w-0 h-full" style={{ padding: "4px 0" }}>
          <FitText max={110} min={16} lineHeight={1} style={{ ...display, color: "var(--color-text-2)", display: "flex", alignItems: "center" }}>
            {next || "—"}
          </FitText>
        </div>
        {barsLeft !== null && clock.isPlaying && (
          <div className="shrink-0 text-right">
            <div className="seg" style={{ fontSize: "clamp(26px, min(5vw, 8vh), 64px)", lineHeight: 1 }}>{barsLeft}</div>
            <div style={vfdCaption}>{barsLeft === 1 ? "compás" : "compases"}</div>
          </div>
        )}
      </div>

      {standalone && (
        <a
          href="#"
          onClick={() => {
            window.location.hash = "";
          }}
          className="label-cap"
          style={{ position: "fixed", bottom: 2, right: 10, fontSize: 10, color: "var(--color-text-3)", textDecoration: "none" }}
        >
          Salir
        </a>
      )}
    </div>
  );
}

const stageLabel: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "clamp(12px, 1.6vw, 18px)",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--color-text-3)",
  marginBottom: 6,
};

const vfdCaption: React.CSSProperties = {
  marginTop: 6,
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-vfd-ink)",
  opacity: 0.55,
};
