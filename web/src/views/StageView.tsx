/**
 * Stage view: what the band needs to read from across the stage.
 *
 *   ┌ Setlist · Canción 2 de 4 · Proyecto ─────────── [Compás · BPM · Falta] ┐
 *   │ AHORA                                                                  │
 *   │   <part that is playing — or the song, if it has no parts>             │
 *   │   <song name, when a part is shown>                         ● ● ● ●   │
 *   ├────────────────────────────────────────────────────────────────────────┤
 *   │ SIGUE  <next part, or next song of the setlist>      DESPUÉS <song>   │
 *   └────────────────────────────────────────────────────────────────────────┘
 *
 * Source of truth: the Setlist (song track + parts/locators). Without it,
 * the arrangement's locators around the playhead.
 *
 * Open http://<mac>:39031/#escenario on a second device to get only this
 * screen, full size, with no navigation.
 */
import { useAbleton, useConnectionStatus, useLiveProp } from "../lib/hooks";
import { useSongClock } from "../lib/clock";
import { useLiveRawList } from "../lib/list-hooks";
import { formatDuration, useSongStructure } from "../lib/song-structure";
import { colorToHex } from "../lib/color";
import { FitText } from "../components/FitText";

export function StageView({ standalone }: { standalone?: boolean }) {
  const client = useAbleton();
  const status = useConnectionStatus();
  const clock = useSongClock(client);
  const st = useSongStructure(client);
  const cues = useLiveRawList<any>("song", "cue_points");
  const projectName = useLiveProp<string>(client, (c) => c.song, "name", { listen: false, pollMs: 4000 });

  const barQ = (clock.beatsPerBar * 4) / clock.beatUnit;
  const connected = status.kind === "connected";

  // ---- what to show -------------------------------------------------
  let songName = "";
  let partName = "";
  let nextLabel = "Sigue";
  let nextName = "";
  let afterName = "";
  let nextQueued = false;
  let barsLeft: number | null = null;
  let songLeftSec: number | null = null;
  let accent: string | undefined;
  let position = "";

  const song = st.configured ? st.playingSong ?? st.song : null;

  if (song) {
    songName = song.name;
    const inThisSong = st.song?.key === song.key;
    const part = inThisSong ? st.currentPart : null;
    partName = part?.name ?? "";
    accent = colorToHex(part?.color ?? song.color);

    const order = st.songs ?? [];
    const idx = order.findIndex((s) => s.key === song.key);
    const nextSong = idx >= 0 ? order[idx + 1] ?? null : null;
    if (idx >= 0) position = `Canción ${idx + 1} de ${order.length}`;

    if (inThisSong && st.queuedPart) {
      nextName = st.queuedPart.name;
      nextLabel = "Entra";
      nextQueued = true;
      afterName = nextSong?.name ?? "";
    } else if (inThisSong && st.nextPart) {
      nextName = st.nextPart.name;
      afterName = nextSong?.name ?? "";
    } else if (inThisSong && !part && st.songParts[0] && !clock.isPlaying) {
      nextName = st.songParts[0].name;
      afterName = nextSong?.name ?? "";
    } else if (nextSong) {
      nextLabel = "Siguiente canción";
      nextName = nextSong.name;
    } else {
      nextLabel = "Sigue";
      nextName = "Fin del setlist";
    }

    // Bars left in the part; time left in the song (Arrangement only).
    if (clock.isPlaying && part?.end !== undefined) {
      barsLeft = Math.max(0, Math.ceil((part.end - clock.beats) / barQ - 1e-6));
    }
    const end = st.songEnd(song);
    if (clock.isPlaying && song.source === "arrangement" && isFinite(end)) {
      songLeftSec = Math.max(0, ((end - clock.beats) * 60) / st.bpmOf(song));
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
    songName = cur ? String(cur.name || `Marca ${idx + 1}`) : "";
    nextName = nxt ? String(nxt.name || `Marca ${idx + 2}`) : "Fin del arreglo";
    nextLabel = "Siguiente marca";
    if (nxt && clock.isPlaying) barsLeft = Math.max(0, Math.ceil((Number(nxt.time) - clock.beats) / barQ - 1e-6));
    if (idx >= 0) position = `Marca ${idx + 1} de ${sorted.length}`;
  }

  // NOW: the part when there is one, otherwise the song itself.
  const nowBig = !connected ? "Esperando a Live…" : partName || songName || (clock.isPlaying ? "En reproducción" : "Parado");
  const nowSmall = partName ? songName : "";
  const color = accent ?? "var(--color-vfd-ink)";
  const setlistName = st.activeSetlist?.name ?? (st.configured ? "Orden del set" : "");

  const beat = clock.beat;
  const beatsInBar = Math.max(1, Math.min(16, clock.beatsPerBar));

  const display: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    letterSpacing: "0",
    color: "var(--color-text-1)",
  };

  return (
    <div
      className="h-full w-full flex flex-col"
      style={{
        position: "relative",
        padding: "clamp(10px, min(2.6vw, 3vh), 28px)",
        gap: "clamp(8px, 1.8vh, 20px)",
        background: "radial-gradient(120% 90% at 50% 0%, #1a1712 0%, #0b0c0e 70%)",
      }}
    >
      {/* ── Info bar: setlist · position · project ───────────── VFD ── */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-baseline gap-3 flex-wrap" style={{ rowGap: 2 }}>
            {setlistName && (
              <span className="truncate" style={{ ...display, fontSize: "clamp(18px, min(3vw, 4vh), 34px)", color: "var(--color-accent-cue)", maxWidth: "100%" }}>
                {setlistName}
              </span>
            )}
            {position && <span style={{ ...stageLabel, marginBottom: 0 }}>{position}</span>}
          </div>
          <span className="truncate" style={{ fontSize: "clamp(12px, min(1.6vw, 2.2vh), 17px)", color: "var(--color-text-3)", fontWeight: 600 }}>
            {projectName ? `Proyecto · ${projectName}` : connected ? "" : "Sin conexión con Live"}
          </span>
        </div>
        <div className="vfd flex items-end gap-4 sm:gap-6 shrink-0" style={{ padding: "clamp(6px, 1.2vh, 12px) clamp(10px, 1.6vw, 18px)" }}>
          <VfdStat value={clock.barsDisplay.split(".").slice(0, 2).join(".")} label="Compás" size="clamp(20px, min(3.6vw, 5.5vh), 42px)" />
          <VfdStat value={clock.tempo.toFixed(0)} label={`BPM · ${clock.signatureDisplay}`} size="clamp(18px, min(2.8vw, 4.2vh), 32px)" />
          {songLeftSec !== null && <VfdStat value={formatDuration(songLeftSec)} label="Falta" size="clamp(18px, min(2.8vw, 4.2vh), 32px)" />}
        </div>
        {!standalone && (
          <a
            href="#escenario"
            className="tactile label-cap shrink-0 hidden md:inline-flex"
            style={{ padding: "8px 10px", fontSize: 10, color: "var(--color-text-2)", textDecoration: "none" }}
            title="Solo esta pantalla. En otro iPad o teléfono abre la misma dirección terminada en #escenario"
          >
            Pantalla completa
          </a>
        )}
      </div>

      {/* ── NOW ──────────────────────────────────────────────────────── */}
      <div
        className="flex-1 min-h-0 flex flex-col"
        style={{
          borderRadius: 24,
          padding: "clamp(10px, min(2.6vw, 3vh), 32px)",
          background: `linear-gradient(180deg, color-mix(in srgb, ${color} 20%, #15161a), color-mix(in srgb, ${color} 7%, #0f1013))`,
          boxShadow: `inset 0 0 0 2px color-mix(in srgb, ${color} 55%, transparent), 0 0 60px color-mix(in srgb, ${color} 14%, transparent)`,
        }}
      >
        <div className="flex items-center gap-3 shrink-0">
          <span style={{ ...stageLabel, color, marginBottom: 0 }}>Ahora</span>
          <span className="flex-1" />
          {/* Beat lights */}
          <div className="flex items-center gap-2 sm:gap-3" aria-label={`Tiempo ${beat} de ${beatsInBar}`}>
            {Array.from({ length: beatsInBar }).map((_, i) => {
              const on = clock.isPlaying && i + 1 === beat;
              const c = i === 0 ? "var(--color-accent-rec)" : "var(--color-accent-cue)";
              return (
                <span
                  key={i}
                  style={{
                    width: "clamp(12px, min(2.6vw, 3.6vh), 30px)",
                    height: "clamp(12px, min(2.6vw, 3.6vh), 30px)",
                    borderRadius: "50%",
                    background: on ? c : "rgba(255,255,255,0.07)",
                    boxShadow: on ? `0 0 20px ${c}, 0 0 6px ${c}` : "inset 0 2px 4px rgba(0,0,0,0.6)",
                    transition: "background 40ms, box-shadow 40ms",
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="flex-1 min-h-0 relative" style={{ marginTop: "clamp(4px, 1vh, 12px)" }}>
          <FitText max={300} min={22} lineHeight={0.98} style={{ ...display, display: "flex", alignItems: "center" }}>
            {nowBig}
          </FitText>
        </div>
        {nowSmall && (
          <div className="relative shrink-0" style={{ height: "clamp(28px, 8vh, 80px)", marginTop: "clamp(4px, 1vh, 10px)" }}>
            <FitText max={64} min={14} style={{ ...display, color: "var(--color-text-2)", display: "flex", alignItems: "center" }}>
              {nowSmall}
            </FitText>
          </div>
        )}
      </div>

      {/* ── NEXT ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-stretch gap-4 sm:gap-6 shrink-0"
        style={{
          height: "clamp(72px, 19vh, 180px)",
          borderRadius: 18,
          padding: "clamp(8px, 1.6vh, 18px) clamp(14px, 2.4vw, 28px)",
          background: "#141519",
          boxShadow: nextQueued ? "inset 0 0 0 2px var(--color-accent-cue)" : "inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex-1 min-w-0 flex flex-col">
          <span className={nextQueued ? "beat-dot" : undefined} style={{ ...stageLabel, color: nextQueued ? "var(--color-accent-cue)" : undefined }}>
            {nextLabel}
          </span>
          <div className="flex-1 min-h-0 relative">
            <FitText max={120} min={16} style={{ ...display, color: "var(--color-text-1)", opacity: 0.85, display: "flex", alignItems: "center" }}>
              {nextName || "—"}
            </FitText>
          </div>
        </div>
        {afterName && (
          <div className="flex flex-col justify-center shrink-0" style={{ maxWidth: "34%", borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "clamp(10px, 2vw, 24px)" }}>
            <span style={stageLabel}>Después</span>
            <span style={{ ...display, fontSize: "clamp(16px, min(2.6vw, 3.6vh), 34px)", color: "var(--color-text-2)", lineHeight: 1.05 }}>
              {afterName}
            </span>
          </div>
        )}
        {barsLeft !== null && (
          <div className="flex flex-col justify-center items-end shrink-0">
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

function VfdStat({ value, label, size }: { value: string; label: string; size: string }) {
  return (
    <div>
      <div className="seg" style={{ fontSize: size, lineHeight: 1 }}>{value}</div>
      <div style={vfdCaption}>{label}</div>
    </div>
  );
}

const stageLabel: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 700,
  fontSize: "clamp(11px, min(1.5vw, 2vh), 17px)",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--color-text-3)",
  marginBottom: 4,
};

const vfdCaption: React.CSSProperties = {
  marginTop: 5,
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-vfd-ink)",
  opacity: 0.55,
};
