import { useAbleton, useLiveProp } from "../lib/hooks";
import { TempoDial } from "../components/TempoDial";
import { useLiveRawList } from "../lib/list-hooks";
import { toast } from "../lib/toast";
import { jumpToTime } from "../lib/cue-jump";
import { useSongClock, formatTimeMs } from "../lib/clock";

export function TransportView() {
  const client = useAbleton();
  const tempo = useLiveProp<any>(client, (c) => c.song, "tempo");
  const signatureNum = useLiveProp<any>(client, (c) => c.song, "signature_numerator");
  const signatureDen = useLiveProp<any>(client, (c) => c.song, "signature_denominator");
  const loop = useLiveProp<any>(client, (c) => c.song, "loop");
  const punchIn = useLiveProp<any>(client, (c) => c.song, "punch_in");
  const punchOut = useLiveProp<any>(client, (c) => c.song, "punch_out");
  const overdub = useLiveProp<any>(client, (c) => c.song, "overdub");
  const metronome = useLiveProp<any>(client, (c) => c.song, "metronome");
  const countIn = useLiveProp<any>(client, (c) => c.song, "count_in_duration");
  const clock = useSongClock(client);
  const cuePoints = useLiveRawList<any>("song", "cue_points");

  if (!client) return <Center>Sin conexión</Center>;

  return (
    <div className="h-full overflow-auto scroll-touch p-4 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 max-w-5xl">
        <Panel title="Tempo">
          <div className="flex items-end gap-6">
            {tempo !== undefined && (
              <>
                <TempoDial
                  tempo={tempo}
                  onChange={(t) => client.song.set("tempo", t)}
                />
                <div className="flex flex-col gap-2 pb-1">
                  <SmallButton label="Tap" onClick={() => client.song.tapTempo()} />
                  <SmallButton
                    label="Nudge −"
                    onClick={() => client.song.set("nudge_down", true)}
                  />
                  <SmallButton
                    label="Nudge +"
                    onClick={() => client.song.set("nudge_up", true)}
                  />
                </div>
              </>
            )}
          </div>
        </Panel>

        <Panel title="Time signature">
          <div className="flex items-end gap-4">
            <NumberStepper
              label="Beats"
              value={signatureNum ?? 4}
              min={1}
              max={32}
              onChange={(v) => client.song.set("signature_numerator", v)}
            />
            <span
              className="value-mono"
              style={{ fontSize: 36, color: "var(--color-text-3)", paddingBottom: 14 }}
            >
              /
            </span>
            <NumberStepper
              label="Unit"
              value={signatureDen ?? 4}
              min={1}
              max={32}
              onChange={(v) => client.song.set("signature_denominator", v)}
            />
          </div>
        </Panel>

        <Panel title="Modes">
          <div className="grid grid-cols-2 gap-2">
            <BigToggle
              label="Loop arrangement"
              active={!!loop}
              onClick={() => client.song.set("loop", !loop)}
              color="var(--color-accent-cue)"
            />
            <BigToggle
              label="Punch in"
              active={!!punchIn}
              onClick={() => client.song.set("punch_in", !punchIn)}
              color="var(--color-accent-rec)"
            />
            <BigToggle
              label="Punch out"
              active={!!punchOut}
              onClick={() => client.song.set("punch_out", !punchOut)}
              color="var(--color-accent-rec)"
            />
            <BigToggle
              label="Overdub"
              active={!!overdub}
              onClick={() => client.song.set("overdub", !overdub)}
              color="var(--color-accent-macro)"
            />
            <BigToggle
              label="Click"
              active={!!metronome}
              onClick={() => client.song.set("metronome", metronome ? 0 : 1)}
              color="var(--color-accent-cue)"
            />
            <div className="flex flex-col gap-1.5">
              <span className="label-cap">Count-in bars</span>
              <div
                className="value-mono flex items-center justify-center"
                style={{
                  width: 64,
                  height: 56,
                  background: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 6,
                  fontSize: 28,
                  fontWeight: 700,
                  color: "var(--color-text-1)",
                }}
              >
                {countIn ?? "—"}
              </div>
              <span className="label-cap" style={{ fontSize: 9 }}>
                Solo lectura · se cambia en Live
              </span>
            </div>
          </div>
        </Panel>

        <Panel title="Cue points">
          <div className="flex flex-col gap-2 max-h-64 overflow-auto">
            {cuePoints && cuePoints.length > 0 ? (
              cuePoints.map((cp, i) => (
                <button
                  key={cp.id ?? i}
                  onClick={() => {
                    void jumpToTime(client, Number(cp.time ?? 0)).catch(() =>
                      toast("No se pudo saltar a la marca"),
                    );
                  }}
                  className="tactile flex items-center gap-3 px-3"
                  style={{ height: 44 }}
                >
                  <span
                    className="value-mono"
                    style={{
                      fontSize: 11,
                      color: "var(--color-accent-cue)",
                      width: 18,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="truncate flex-1 text-left"
                    style={{ fontSize: 13, color: "var(--color-text-1)" }}
                  >
                    {cp.name || `Cue ${i + 1}`}
                  </span>
                  <span
                    className="value-mono"
                    style={{ fontSize: 11, color: "var(--color-text-3)" }}
                  >
                    {cp.time?.toFixed(2)}s
                  </span>
                </button>
              ))
            ) : (
              <div className="label-cap" style={{ color: "var(--color-text-3)" }}>
                Sin cue points. Toca el setlist para crear.
              </div>
            )}
            <div className="flex gap-2 mt-1">
              <SmallButton
                label="← Previous"
                onClick={() => client.song.jumpToPrevCue()}
                flex
              />
              <SmallButton
                label="Next →"
                onClick={() => client.song.jumpToNextCue()}
                flex
              />
              <SmallButton
                label="Add here"
                onClick={() => client.song.setOrDeleteCue()}
                flex
              />
            </div>
          </div>
        </Panel>

        <Panel title="Position">
          <div className="flex items-end gap-6 flex-wrap">
            <div>
              <div
                className="value-mono"
                style={{
                  fontSize: "clamp(40px, 12vw, 56px)",
                  fontWeight: 700,
                  color: "var(--color-text-1)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                {formatTimeMs(clock.timeSec)}
              </div>
              <div className="label-cap" style={{ marginTop: 6 }}>
                Bars {clock.barsDisplay} · {clock.signatureDisplay}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <SmallButton
                label="−1 bar"
                onClick={() => {
                  const sec = ((60 / clock.tempo) * clock.beatsPerBar).toFixed(3);
                  void client.song
                    .jumpBy(-Number(sec))
                    .catch(() => toast("No se pudo mover"));
                }}
              />
              <SmallButton
                label="+1 bar"
                onClick={() => {
                  const sec = ((60 / clock.tempo) * clock.beatsPerBar).toFixed(3);
                  void client.song
                    .jumpBy(Number(sec))
                    .catch(() => toast("No se pudo mover"));
                }}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Edit history">
          <div className="grid grid-cols-2 gap-2">
            <BigToggle
              label="Undo"
              active={false}
              onClick={() => client.song.undo()}
              color="var(--color-text-2)"
            />
            <BigToggle
              label="Redo"
              active={false}
              onClick={() => client.song.redo()}
              color="var(--color-text-2)"
            />
            <BigToggle
              label="Stop all clips"
              active={false}
              onClick={() => client.song.stopAllClips()}
              color="var(--color-accent-stop)"
            />
            <BigToggle
              label="Back to arranger"
              active={false}
              onClick={() => client.song.set("back_to_arranger", 1)}
              color="var(--color-accent-macro)"
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel" style={{ padding: 20 }}>
      <h3
        style={{
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-text-3)",
          margin: 0,
          marginBottom: 16,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="label-cap" style={{ color: "var(--color-text-3)" }}>
        {children}
      </span>
    </div>
  );
}

function BigToggle({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="tactile flex items-center justify-center"
      style={{
        height: 56,
        background: active
          ? `color-mix(in srgb, ${color} 25%, var(--color-surface-2))`
          : "var(--color-surface-2)",
        color: active ? color : "var(--color-text-2)",
        border: `1.5px solid ${active ? color : "var(--color-border)"}`,
        fontSize: 14,
        fontWeight: 600,
        borderRadius: 10,
        letterSpacing: "-0.005em",
      }}
    >
      {label}
    </button>
  );
}

function NumberStepper({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label-cap">{label}</span>
      <div className="flex items-center gap-1">
        <button
          className="tactile"
          style={{
            width: 36,
            height: 56,
            color: "var(--color-text-2)",
            fontSize: 18,
            fontWeight: 600,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
          }}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <div
          className="value-mono flex items-center justify-center"
          style={{
            width: 64,
            height: 56,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            fontSize: 28,
            fontWeight: 700,
            color: "var(--color-text-1)",
          }}
        >
          {value}
        </div>
        <button
          className="tactile"
          style={{
            width: 36,
            height: 56,
            color: "var(--color-text-2)",
            fontSize: 18,
            fontWeight: 600,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
          }}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SmallButton({
  label,
  onClick,
  flex,
}: {
  label: string;
  onClick: () => void;
  flex?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="tactile"
      style={{
        height: 36,
        padding: "0 12px",
        background: "var(--color-surface-2)",
        color: "var(--color-text-1)",
        fontSize: 12,
        fontWeight: 600,
        border: "1px solid var(--color-border)",
        borderRadius: 6,
        flex: flex ? 1 : undefined,
      }}
    >
      {label}
    </button>
  );
}


