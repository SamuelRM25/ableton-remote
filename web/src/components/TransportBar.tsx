import { useEffect, useState } from "react";
import { useAbleton, useLiveProp, useSongToggle } from "../lib/hooks";
import { IconClick, IconLoop, IconPlay, IconRecord, IconStop } from "./icons";
import { TempoDial } from "./TempoDial";
import { LedKey, glow } from "./hw";
import { toast } from "../lib/toast";
import { onArmedStartChange, peekArmedStart, startFrom, takeArmedStart } from "../lib/cue-jump";
import { beatsToBarLabel } from "../lib/clock";

async function safeRun(fn: () => Promise<unknown>, label: string) {
  try {
    await fn();
  } catch {
    toast(`No se pudo ${label}`);
  }
}

/**
 * Bottom transport strip. REC is Live's main record button
 * (song.record_mode, arrangement record); SES is the Session Record
 * button (song.session_record). Both are booleans in Live.
 */
export function TransportBar() {
  const client = useAbleton();
  const isPlaying = !!useLiveProp<boolean>(client, (c) => c.song, "is_playing");
  const tempo = useLiveProp<number>(client, (c) => c.song, "tempo");

  const onErr = (label: string) => () => toast(`No se pudo ${label}`);
  const [recOn, toggleRec] = useSongToggle(client, "record_mode", onErr("activar la grabación"));
  const [sesOn, toggleSes] = useSongToggle(client, "session_record", onErr("activar Session Record"));
  const [loopOn, toggleLoop] = useSongToggle(client, "loop", onErr("cambiar el loop"));
  const [clickOn, toggleClick] = useSongToggle(client, "metronome", onErr("cambiar el click"));
  const [ovrOn, toggleOvr] = useSongToggle(client, "arrangement_overdub", onErr("cambiar overdub"));

  const disabled = !client;
  // Where Play will start after picking a song/part/marker while stopped.
  const [armed, setArmed] = useState<number | null>(peekArmedStart());
  useEffect(() => onArmedStartChange(setArmed), []);

  return (
    <footer
      className="shrink-0 flex items-center gap-2.5 xl:gap-3.5 overflow-x-auto scroll-touch px-3 sm:px-5"
      style={{
        height: 100,
        paddingBottom: "env(safe-area-inset-bottom)",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0) 30%), linear-gradient(180deg, #1f2125, #17181b)",
        borderTop: "1px solid rgba(0,0,0,0.8)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07), 0 -8px 24px rgba(0,0,0,0.35)",
        touchAction: "pan-x",
      }}
    >
      {/* Cue jump */}
      <KeyStack label="Marca">
        <div className="flex gap-1.5">
          <LedKey
            size="md"
            width={46}
            disabled={disabled}
            color="cue"
            title="Marca anterior"
            label={<Chevrons dir="left" />}
            onClick={() => client && void safeRun(() => client.song.jumpToPrevCue(), "ir a la marca anterior")}
          />
          <LedKey
            size="md"
            width={46}
            disabled={disabled}
            color="cue"
            title="Marca siguiente"
            label={<Chevrons dir="right" />}
            onClick={() => client && void safeRun(() => client.song.jumpToNextCue(), "ir a la marca siguiente")}
          />
        </div>
      </KeyStack>

      <Seam />

      {/* Stop · Play · Rec */}
      <BigKey
        label="Stop"
        color="var(--color-accent-stop)"
        active={false}
        disabled={disabled}
        onPress={() =>
          client &&
          void safeRun(async () => {
            // Second press while stopped returns to the start, like Live.
            takeArmedStart();
            await client.song.stopPlaying();
          }, "parar")
        }
      >
        <IconStop size={20} />
      </BigKey>

      <BigKey
        label={isPlaying ? "Playing" : armed !== null ? `Desde ${beatsToBarLabel(armed)}` : "Play"}
        color="var(--color-accent-play)"
        active={isPlaying}
        disabled={disabled}
        hero
        onPress={() =>
          client &&
          void safeRun(
            () =>
              isPlaying
                ? client.song.stopPlaying()
                : // After choosing a song / part / marker while stopped,
                  // play from IT — not from where Live last stopped.
                  (() => {
                    const armed = takeArmedStart();
                    return armed !== null ? startFrom(client, armed) : client.song.startPlaying();
                  })(),
            isPlaying ? "pausar" : "reproducir",
          )
        }
      >
        <span style={{ marginLeft: 3, display: "flex" }}>
          <IconPlay size={26} />
        </span>
      </BigKey>

      <BigKey
        label="Rec"
        color="var(--color-accent-rec)"
        active={recOn}
        blink={recOn && isPlaying}
        disabled={disabled}
        onPress={() => void toggleRec()}
      >
        <IconRecord size={22} />
      </BigKey>

      <KeyStack label="Session">
        <LedKey
          size="md"
          variant="ring"
          color="rec"
          active={sesOn}
          disabled={disabled}
          title="Session Record"
          icon={<SessionRecIcon />}
          onClick={() => void toggleSes()}
          width={50}
        />
      </KeyStack>

      <Seam />

      <KeyStack label="Loop">
        <LedKey size="md" variant="ring" color="cue" active={loopOn} disabled={disabled} icon={<IconLoop size={18} />} onClick={() => void toggleLoop()} width={50} />
      </KeyStack>
      <KeyStack label="Click">
        <LedKey size="md" variant="ring" color="cue" active={clickOn} disabled={disabled} icon={<IconClick size={18} />} onClick={() => void toggleClick()} width={50} />
      </KeyStack>
      <KeyStack label="OVR" className="hidden lg:flex">
        <LedKey size="md" variant="ring" color="macro" active={ovrOn} disabled={disabled} label="+" onClick={() => void toggleOvr()} width={50} style={{ fontSize: 20 }} />
      </KeyStack>

      <div className="flex-1 shrink-0" style={{ minWidth: 8 }} />

      {client && tempo !== undefined && (
        <div className="shrink-0 flex items-center gap-2">
          <KeyStack label="Tempo" className="hidden lg:flex">
            <LedKey
              size="md"
              width={50}
              color="cue"
              label="Tap"
              onClick={() => void safeRun(() => client.song.tapTempo(), "marcar el tempo")}
            />
          </KeyStack>
          <TempoDial
            tempo={tempo}
            onChange={(t) => {
              void client.song.set("tempo", t).catch(() => toast("No se pudo cambiar el tempo"));
            }}
          />
        </div>
      )}
    </footer>
  );
}

function Seam() {
  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{
        width: 2,
        height: 56,
        borderLeft: "1px solid rgba(0,0,0,0.7)",
        borderRight: "1px solid rgba(255,255,255,0.05)",
      }}
    />
  );
}

function KeyStack({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`shrink-0 flex flex-col items-center gap-1.5 ${className ?? ""}`}>
      {children}
      <span className="label-cap" style={{ fontSize: 10 }}>
        {label}
      </span>
    </div>
  );
}

/** Round transport key with an LED ring around it. */
function BigKey({
  label,
  color,
  active,
  blink,
  hero,
  disabled,
  onPress,
  children,
}: {
  label: string;
  color: string;
  active: boolean;
  blink?: boolean;
  hero?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const [down, setDown] = useState(false);
  const d = hero ? 66 : 56;
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      disabled={disabled}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onClick={onPress}
      className="shrink-0 flex flex-col items-center gap-1.5"
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      {/* LED ring (bezel) */}
      <span
        className={blink ? "rec-blink" : undefined}
        style={{
          width: d + 8,
          height: d + 8,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: active
            ? `conic-gradient(from 210deg, ${color}, color-mix(in srgb, ${color} 60%, black), ${color}, color-mix(in srgb, ${color} 60%, black), ${color})`
            : "linear-gradient(180deg, #0b0c0e, #2a2c31)",
          boxShadow: active ? glow(color, 1.6) : "inset 0 1px 2px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.06)",
          transition: "box-shadow 140ms var(--ease-instrument), background 140ms",
        }}
      >
        {/* rubber cap */}
        <span
          style={{
            width: d,
            height: d,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: active ? color : "var(--color-text-2)",
            background:
              "radial-gradient(circle at 50% 30%, #42454c 0%, #2b2d33 55%, #1d1e22 100%)",
            boxShadow: down
              ? "inset 0 3px 8px rgba(0,0,0,0.8)"
              : "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -3px 6px rgba(0,0,0,0.45), 0 3px 6px rgba(0,0,0,0.6)",
            transform: down ? "scale(0.97)" : undefined,
            filter: active ? `drop-shadow(0 0 6px ${color})` : undefined,
            transition: "transform 60ms, box-shadow 80ms",
          }}
        >
          {children}
        </span>
      </span>
      <span className="label-cap" style={{ fontSize: 10, color: active ? color : undefined }}>
        {label}
      </span>
    </button>
  );
}

function Chevrons({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" fill="currentColor" aria-hidden>
      {dir === "left" ? (
        <>
          <path d="M8 1 L1 7 L8 13 Z" />
          <path d="M17 1 L10 7 L17 13 Z" />
        </>
      ) : (
        <>
          <path d="M1 1 L8 7 L1 13 Z" />
          <path d="M10 1 L17 7 L10 13 Z" />
        </>
      )}
    </svg>
  );
}

/** Live's Session Record glyph: a dot inside a square. */
function SessionRecIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="3.6" fill="currentColor" />
    </svg>
  );
}
