import { useAbleton, useLiveProp, useSongToggle } from "../lib/hooks";
import { TempoDial } from "../components/TempoDial";
import { useLiveRawList } from "../lib/list-hooks";
import { toast } from "../lib/toast";
import { jumpToTime } from "../lib/cue-jump";
import { useSongClock, formatTimeMs, beatsToBarLabel } from "../lib/clock";
import { EmptyPanel, LedKey, Plate } from "../components/hw";

function run(p: Promise<unknown> | undefined, msg: string) {
  void p?.catch(() => toast(msg));
}

export function TransportView() {
  const client = useAbleton();
  const tempo = useLiveProp<number>(client, (c) => c.song, "tempo");
  const signatureNum = useLiveProp<number>(client, (c) => c.song, "signature_numerator");
  const signatureDen = useLiveProp<number>(client, (c) => c.song, "signature_denominator");
  const countIn = useLiveProp<number>(client, (c) => c.song, "count_in_duration");
  const backToArranger = !!useLiveProp<boolean>(client, (c) => c.song, "back_to_arranger");
  const clock = useSongClock(client);
  const cuePoints = useLiveRawList<any>("song", "cue_points");

  const err = (m: string) => () => toast(m);
  const [loop, toggleLoop] = useSongToggle(client, "loop", err("No se pudo cambiar el loop"));
  const [punchIn, togglePunchIn] = useSongToggle(client, "punch_in", err("No se pudo cambiar punch in"));
  const [punchOut, togglePunchOut] = useSongToggle(client, "punch_out", err("No se pudo cambiar punch out"));
  const [overdub, toggleOverdub] = useSongToggle(client, "arrangement_overdub", err("No se pudo cambiar overdub"));
  const [metronome, toggleMetronome] = useSongToggle(client, "metronome", err("No se pudo cambiar el click"));
  const [rec, toggleRec] = useSongToggle(client, "record_mode", err("No se pudo activar la grabación"));
  const [sesRec, toggleSesRec] = useSongToggle(client, "session_record", err("No se pudo activar Session Record"));
  const [automation, toggleAutomation] = useSongToggle(client, "session_automation_record", err("No se pudo cambiar automation arm"));

  if (!client) {
    return <EmptyPanel title="Live no está conectado" hint="Abre Ableton Live con AbletonJS activo como Control Surface." />;
  }

  const bpb = clock.beatsPerBar;
  // One bar in Live beats (quarter notes) for the current signature.
  const barBeats = (bpb * 4) / clock.beatUnit;

  return (
    <div className="h-full overflow-auto scroll-touch p-3 sm:p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 max-w-6xl mx-auto">
        {/* Position — the big readout */}
        <Plate title="Posición" className="md:col-span-2 xl:col-span-2">
          <div className="vfd flex flex-wrap items-end gap-x-8 gap-y-3" style={{ padding: "18px 22px" }}>
            <div>
              <div className="seg" style={{ fontSize: "clamp(40px, 9vw, 72px)", lineHeight: 1 }}>
                {clock.barsDisplay}
              </div>
              <div style={vfdCaption}>Compás · tiempo · semicorchea</div>
            </div>
            <div>
              <div className="seg" style={{ fontSize: "clamp(24px, 5vw, 36px)", lineHeight: 1 }}>
                {formatTimeMs(clock.timeSec)}
              </div>
              <div style={vfdCaption}>Minutos</div>
            </div>
            <div>
              <div className="seg" style={{ fontSize: "clamp(24px, 5vw, 36px)", lineHeight: 1 }}>
                {clock.signatureDisplay}
              </div>
              <div style={vfdCaption}>Compás</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <LedKey size="md" label="− 1 compás" onClick={() => run(client.song.jumpBy(-barBeats), "No se pudo mover")} />
            <LedKey size="md" label="+ 1 compás" onClick={() => run(client.song.jumpBy(barBeats), "No se pudo mover")} />
            <LedKey size="md" label="Al inicio" onClick={() => run(jumpToTime(client, 0), "No se pudo mover")} />
          </div>
        </Plate>

        {/* Tempo */}
        <Plate title="Tempo">
          {tempo !== undefined && (
            <div className="flex flex-col gap-3">
              <TempoDial
                size="large"
                tempo={tempo}
                onChange={(t) => run(client.song.set("tempo", t), "No se pudo cambiar el tempo")}
              />
              <div className="grid grid-cols-3 gap-2">
                <LedKey size="md" label="Tap" onClick={() => run(client.song.tapTempo(), "No se pudo marcar el tempo")} />
                <LedKey size="md" label="Nudge −" onClick={() => run(client.song.set("nudge_down", true), "No se pudo")} />
                <LedKey size="md" label="Nudge +" onClick={() => run(client.song.set("nudge_up", true), "No se pudo")} />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[-1, -0.1, 0.1, 1].map((d) => (
                  <LedKey
                    key={d}
                    size="sm"
                    label={`${d > 0 ? "+" : "−"}${Math.abs(d)}`}
                    onClick={() =>
                      run(
                        client.song.set("tempo", Math.round((tempo + d) * 100) / 100),
                        "No se pudo cambiar el tempo",
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </Plate>

        {/* Record */}
        <Plate title="Grabación">
          <div className="grid grid-cols-2 gap-2">
            <LedKey size="lg" color="rec" active={rec} blink={rec && clock.isPlaying} label="Rec arreglo" onClick={() => void toggleRec()} />
            <LedKey size="lg" color="rec" active={sesRec} label="Rec session" onClick={() => void toggleSesRec()} />
            <LedKey size="lg" color="rec" variant="ring" active={punchIn} label="Punch in" onClick={() => void togglePunchIn()} />
            <LedKey size="lg" color="rec" variant="ring" active={punchOut} label="Punch out" onClick={() => void togglePunchOut()} />
            <LedKey size="lg" color="macro" variant="ring" active={overdub} label="Overdub" onClick={() => void toggleOverdub()} />
            <LedKey size="lg" color="rec" variant="ring" active={automation} label="Automation" onClick={() => void toggleAutomation()} />
          </div>
        </Plate>

        {/* Modes */}
        <Plate title="Modos">
          <div className="grid grid-cols-2 gap-2">
            <LedKey size="lg" color="cue" active={loop} label="Loop" onClick={() => void toggleLoop()} />
            <LedKey size="lg" color="cue" active={metronome} label="Click" onClick={() => void toggleMetronome()} />
            <LedKey
              size="lg"
              color="stop"
              variant="ring"
              active={backToArranger}
              disabled={!backToArranger}
              label="Al arreglo"
              title="Volver al arreglo (Back to Arrangement)"
              // Live: writing false to back_to_arranger presses the button.
              onClick={() => run(client.song.set("back_to_arranger", false as any), "No se pudo volver al arreglo")}
            />
            <LedKey size="lg" color="stop" label="Parar clips" onClick={() => run(client.song.stopAllClips(), "No se pudieron parar los clips")} />
          </div>
          <div className="flex items-center justify-between mt-4 gap-3">
            <span style={{ fontSize: 13, color: "var(--color-text-2)" }}>Conteo antes de grabar</span>
            <span
              className="vfd"
              style={{ padding: "6px 12px", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--color-vfd-ink)", textShadow: "0 0 6px rgba(255,178,62,0.45)" }}
            >
              {/* Live's count_in_duration is an index: none, 1, 2 or 4 bars. */}
              {countIn === undefined ? "—" : (["Sin conteo", "1 compás", "2 compases", "4 compases"][countIn] ?? String(countIn))}
            </span>
          </div>
        </Plate>

        {/* Signature */}
        <Plate title="Compás">
          <div className="flex items-center justify-center gap-4">
            <Stepper
              value={signatureNum ?? 4}
              min={1}
              max={99}
              label="Tiempos"
              onChange={(v) => run(client.song.set("signature_numerator", v), "No se pudo cambiar el compás")}
            />
            <span className="seg" style={{ fontSize: 40, opacity: 0.5 }}>/</span>
            <Stepper
              value={signatureDen ?? 4}
              min={1}
              max={16}
              label="Figura"
              // Live only accepts powers of two for the denominator.
              onChange={(v) => run(client.song.set("signature_denominator", v), "No se pudo cambiar el compás")}
              steps={[1, 2, 4, 8, 16]}
            />
          </div>
        </Plate>

        {/* Cue points */}
        <Plate title="Marcas" aside={<span className="value-mono" style={{ fontSize: 11, color: "var(--color-text-3)" }}>{cuePoints?.length ?? 0}</span>}>
          <div className="flex flex-col gap-1.5 overflow-auto" style={{ maxHeight: 260 }}>
            {cuePoints && cuePoints.length > 0 ? (
              cuePoints.map((cp, i) => {
                const here = Math.abs(Number(cp.time ?? -1) - clock.beats) < 0.05;
                return (
                  <button
                    key={cp.id ?? i}
                    onClick={() => run(jumpToTime(client, Number(cp.time ?? 0)), "No se pudo saltar a la marca")}
                    className="tactile flex items-center gap-3 px-3 shrink-0"
                    style={{ height: 42, boxShadow: here ? "inset 0 0 0 1px var(--color-accent-cue), var(--shadow-key)" : undefined }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop: "8px solid var(--color-accent-cue)",
                        filter: here ? "drop-shadow(0 0 4px var(--color-accent-cue))" : undefined,
                      }}
                    />
                    <span className="truncate flex-1 text-left" style={{ fontSize: 14, fontWeight: 600 }}>
                      {cp.name || `Marca ${i + 1}`}
                    </span>
                    <span className="value-mono" style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                      {beatsToBarLabel(Number(cp.time ?? 0), bpb, clock.beatUnit)}
                    </span>
                  </button>
                );
              })
            ) : (
              <p style={{ fontSize: 13, color: "var(--color-text-2)", margin: 0 }}>
                No hay marcas en el arreglo. Toca «Marcar aquí» o créalas desde el Setlist.
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <LedKey size="md" color="cue" label="Anterior" onClick={() => run(client.song.jumpToPrevCue(), "No hay marca anterior")} />
            <LedKey size="md" color="cue" label="Siguiente" onClick={() => run(client.song.jumpToNextCue(), "No hay marca siguiente")} />
            <LedKey size="md" color="cue" label="Marcar aquí" onClick={() => run(client.song.setOrDeleteCue(), "No se pudo crear la marca")} />
          </div>
        </Plate>

        {/* History */}
        <Plate title="Historial">
          <div className="grid grid-cols-2 gap-2">
            <LedKey size="lg" label="Deshacer" onClick={() => run(client.song.undo(), "Nada que deshacer")} />
            <LedKey size="lg" label="Rehacer" onClick={() => run(client.song.redo(), "Nada que rehacer")} />
          </div>
        </Plate>
      </div>
    </div>
  );
}

const vfdCaption: React.CSSProperties = {
  marginTop: 8,
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-vfd-ink)",
  opacity: 0.55,
};

function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  steps,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  steps?: number[];
}) {
  const move = (dir: 1 | -1) => {
    if (steps) {
      const i = steps.indexOf(value);
      const next = steps[Math.max(0, Math.min(steps.length - 1, (i < 0 ? 2 : i) + dir))];
      onChange(next);
    } else {
      onChange(Math.max(min, Math.min(max, value + dir)));
    }
  };
  return (
    <div className="flex flex-col items-center gap-2">
      <LedKey size="sm" width={64} label="+" onClick={() => move(1)} style={{ fontSize: 18 }} />
      <span className="vfd seg flex items-center justify-center" style={{ width: 72, height: 54, fontSize: 30 }}>
        {value}
      </span>
      <LedKey size="sm" width={64} label="−" onClick={() => move(-1)} style={{ fontSize: 18 }} />
      <span className="label-cap" style={{ fontSize: 10 }}>{label}</span>
    </div>
  );
}
