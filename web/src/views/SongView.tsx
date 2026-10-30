/**
 * "Canción" view: pads for the parts of the current song.
 * Songs and parts can be clips in the Session OR in the Arrangement;
 * see lib/song-structure.ts.
 */
import { useEffect, useRef, useState } from "react";
import type { Ableton } from "ableton-js";
import { useLiveRawList } from "../lib/list-hooks";
import { colorToHex } from "../lib/color";
import { toast } from "../lib/toast";
import { beatsToBarLabel } from "../lib/clock";
import { jumpOnNextDownbeat } from "../lib/cue-jump";
import { useSongStructure, type SongItem, type SongConfig } from "../lib/song-structure";
import { EmptyPanel, Led, LedKey, ViewStrip } from "../components/hw";

export function SongView({ client }: { client: Ableton | null }) {
  const rawScenes = useLiveRawList<any>("song", "scenes");
  const st = useSongStructure(client);
  const { config, setConfig, song, songs, parts } = st;
  const [setupOpen, setSetupOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const cancelJump = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelJump.current?.(), []);

  async function launch(item: SongItem) {
    if (!client) return;
    try {
      if (item.source === "arrangement") {
        // Arrangement: move the playhead. While playing it waits for the
        // next 1 and lands exactly on the beat.
        cancelJump.current?.();
        st.setPending(item.key);
        cancelJump.current = jumpOnNextDownbeat(client, item.start ?? item.pos, (ok) => {
          st.setPending(null);
          if (!ok) toast(`No se pudo ir a ${item.name}`);
        });
        return;
      }
      if (config.launch === "scene") {
        const scene = rawScenes?.[item.scene];
        if (!scene) throw new Error("no scene");
        await client.sendCommand({ ns: "scene", nsid: String(scene.id), name: "fire" });
      } else {
        await client.sendCommand({ ns: "clip_slot", nsid: String(item.slot_id), name: "fire" });
      }
    } catch {
      toast(`No se pudo lanzar ${item.name}`);
    }
  }

  const { configured } = st;
  const loadingSince =
    st.songsState.kind === "loading" ? st.songsState.since : st.partsState.kind === "loading" ? st.partsState.since : null;
  const readError =
    st.songsState.kind === "error" ? st.songsState.message : st.partsState.kind === "error" ? st.partsState.message : null;

  return (
    <div className="h-full flex flex-col">
      <ViewStrip>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.06em" }}>Canción</span>
        {song && (
          <span className="truncate" style={{ fontSize: 14, color: "var(--color-text-2)" }}>
            {song.name}
          </span>
        )}
        {st.songs && (
          <span className="label-cap hidden md:inline" style={{ fontSize: 10 }}>
            {st.arrangement ? "Clips del arreglo" : "Clips de la session"}
          </span>
        )}
        <div className="flex-1" />
        {configured && (
          <LedKey
            size="sm"
            variant="dot"
            color="link"
            active={config.follow}
            label="Seguir a Live"
            title="Cambiar de canción sola cuando Live toca otra"
            onClick={() => setConfig({ ...config, follow: !config.follow })}
          />
        )}
        {configured && song && (
          <LedKey size="sm" variant="ring" color="cue" active={picking} label="Elegir partes" onClick={() => setPicking((v) => !v)} />
        )}
        <LedKey size="sm" variant="ring" color="white" active={setupOpen} label="Pistas" onClick={() => setSetupOpen((v) => !v)} />
      </ViewStrip>

      {(setupOpen || !configured || st.tracksMissing) && (
        <SetupPanel
          tracks={(st.rawTracks ?? []).map((t: any) => String(t.name ?? ""))}
          config={config}
          onChange={setConfig}
          arrangement={st.arrangement}
          onDone={configured && !st.tracksMissing ? () => setSetupOpen(false) : undefined}
        />
      )}

      {configured && songs && songs.length > 0 && (
        <SongStrip
          songs={songs}
          selected={st.selectedKey}
          playing={st.playingSongKey}
          onSelect={(key) => {
            st.select(key);
            setPicking(false);
          }}
        />
      )}

      <div className="flex-1 min-h-0 overflow-auto scroll-touch p-3 sm:p-5">
        {!client ? (
          <EmptyPanel title="Live no está conectado" hint="La app se reconecta sola en cuanto Live responda." />
        ) : !configured ? null : st.tracksMissing ? (
          <EmptyPanel
            title="No encuentro esas pistas en el set"
            hint={`${!st.songTrackFound ? `«${config.songTrack}» no existe. ` : ""}${!st.partsTrackFound ? `«${config.partsTrack}» no existe. ` : ""}¿Les cambiaste el nombre? Elígelas de nuevo en Pistas.`}
          />
        ) : readError && (!songs || !parts) ? (
          <EmptyPanel title="Live no devolvió los clips" hint={`${readError}. Se vuelve a intentar sola cada pocos segundos.`} />
        ) : !songs || !parts ? (
          <LoadingPanel since={loadingSince} songs={st.songsState.kind} parts={st.partsState.kind} config={config} />
        ) : songs.length === 0 ? (
          <EmptyPanel
            title={`No hay clips en «${config.songTrack}»`}
            hint="Pon un clip MIDI (puede estar vacío) por canción en esa pista, en la Session o en el Arreglo, y ponle el nombre de la canción."
          />
        ) : !song ? (
          <EmptyPanel title="Elige una canción" hint="Tócala en la tira de arriba." />
        ) : picking ? (
          <PartPicker
            song={song}
            parts={parts}
            initial={st.songParts}
            songForPos={st.songForPos}
            onSave={(sel) => {
              setConfig({ ...config, picks: { ...config.picks, [song.name]: sel.map((p) => ({ name: p.name, scene: p.pos })) } });
              setPicking(false);
              toast(`Partes guardadas para ${song.name}`);
            }}
            onAuto={() => {
              const picks = { ...config.picks };
              delete picks[song.name];
              setConfig({ ...config, picks });
              setPicking(false);
              toast(`${song.name}: partes automáticas`);
            }}
            onCancel={() => setPicking(false)}
          />
        ) : (
          <div className="mx-auto" style={{ maxWidth: 1100 }}>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <LedKey
                size="md"
                color="play"
                variant="ring"
                active={st.playingSongKey === song.key}
                label={`▶ ${song.name}`}
                onClick={() => void launch(song)}
                style={{ textTransform: "none", fontSize: 15 }}
              />
              <span style={{ fontSize: 13, color: "var(--color-text-2)" }}>
                {st.songParts.length} {st.songParts.length === 1 ? "parte" : "partes"} · {st.picked ? "elegidas a mano" : "automáticas"} ·{" "}
                {st.arrangement ? "salta en el siguiente compás" : config.launch === "scene" ? "lanza la escena" : "lanza el clip"}
              </span>
            </div>
            {st.songParts.length === 0 ? (
              <EmptyPanel
                title="Esta canción no tiene partes"
                hint={`Pon clips en «${config.partsTrack}» dentro de «${song.name}», o elígelas a mano con «Elegir partes».`}
              />
            ) : (
              <div className="panel" style={{ padding: 14, borderRadius: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                  {st.songParts.map((p, i) => (
                    <PartPad
                      key={p.key}
                      part={p}
                      index={i}
                      playing={st.playingPartKey === p.key}
                      queued={st.firedPartKey === p.key && st.playingPartKey !== p.key}
                      isNext={st.nextPart?.key === p.key}
                      onPress={() => void launch(p)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Loading, with enough detail to tell what Live is (not) answering. */
function LoadingPanel({
  since,
  songs,
  parts,
  config,
}: {
  since: number | null;
  songs: string;
  parts: string;
  config: SongConfig;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  const secs = since ? Math.floor((Date.now() - since) / 1000) : 0;
  const label = (k: string) => (k === "ready" ? "listo" : k === "error" ? "error" : "leyendo…");
  return (
    <EmptyPanel
      title="Leyendo clips de Live…"
      hint={`«${config.songTrack}»: ${label(songs)} · «${config.partsTrack}»: ${label(parts)}${secs >= 3 ? ` · ${secs} s` : ""}`}
    />
  );
}

/* ------------------------------------------------------------------ */

function SetupPanel({
  tracks,
  config,
  onChange,
  onDone,
  arrangement,
}: {
  tracks: string[];
  config: SongConfig;
  onChange: (c: SongConfig) => void;
  onDone?: () => void;
  arrangement?: boolean;
}) {
  const sel = (label: string, value: string, key: "songTrack" | "partsTrack") => (
    <label className="flex flex-col gap-1.5" style={{ minWidth: 180 }}>
      <span className="label-cap" style={{ fontSize: 10 }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange({ ...config, [key]: e.target.value })}
        style={{ border: "1px solid rgba(0,0,0,0.6)", borderRadius: 6, padding: "8px 10px", fontSize: 14 }}
      >
        <option value="">Elegir pista…</option>
        {tracks.map((t, i) => (
          <option key={`${t}-${i}`} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="shrink-0 px-3 sm:px-5 pt-3">
      <div className="panel flex flex-wrap items-end gap-4" style={{ padding: 16 }}>
        {sel("Pista de canciones", config.songTrack, "songTrack")}
        {sel("Pista de partes", config.partsTrack, "partsTrack")}
        {!arrangement && (
          <div className="flex flex-col gap-1.5">
            <span className="label-cap" style={{ fontSize: 10 }}>Al tocar un pad</span>
            <div className="flex gap-1.5">
              <LedKey size="sm" variant="ring" color="cue" active={config.launch === "clip"} label="Lanzar clip" onClick={() => onChange({ ...config, launch: "clip" })} />
              <LedKey size="sm" variant="ring" color="cue" active={config.launch === "scene"} label="Lanzar escena" onClick={() => onChange({ ...config, launch: "scene" })} />
            </div>
          </div>
        )}
        <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-2)", maxWidth: 460, lineHeight: 1.45 }}>
          Sirve con clips en la Session o en el Arreglo. Las partes de cada canción son los clips de la pista de partes que caen dentro de la canción (hasta que empieza la siguiente). En el Arreglo, tocar una parte mueve la reproducción ahí en el siguiente compás, sin salirse del tiempo.
        </p>
        {onDone && <LedKey size="sm" color="play" active label="Listo" onClick={onDone} />}
      </div>
    </div>
  );
}

function SongStrip({
  songs,
  selected,
  playing,
  onSelect,
}: {
  songs: SongItem[];
  selected: string | null;
  playing: string | null;
  onSelect: (key: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(selected ?? "")}"]`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selected]);
  return (
    <div
      ref={ref}
      className="shrink-0 flex items-center gap-2 overflow-x-auto scroll-touch px-3 sm:px-5 py-3"
      style={{ touchAction: "pan-x", borderBottom: "1px solid rgba(0,0,0,0.6)" }}
    >
      {songs.map((s, i) => {
        const active = s.key === selected;
        const isPlaying = s.key === playing;
        const color = colorToHex(s.color) ?? "#8a8d96";
        return (
          <button
            key={s.key}
            data-key={s.key}
            onClick={() => onSelect(s.key)}
            className="tactile shrink-0 flex items-center gap-2"
            style={{
              height: 44,
              padding: "0 14px 0 10px",
              boxShadow: active ? `inset 0 0 0 1.5px var(--color-accent-cue), 0 0 14px rgba(255,178,62,0.25)` : undefined,
            }}
          >
            <span style={{ width: 4, alignSelf: "stretch", margin: "9px 0", borderRadius: 2, background: color }} />
            <span className="value-mono" style={{ fontSize: 10, color: "var(--color-text-3)" }}>{i + 1}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: active ? "var(--color-text-1)" : "var(--color-text-2)", whiteSpace: "nowrap" }}>
              {s.name || "Sin nombre"}
            </span>
            {isPlaying && <Led on color="play" size={6} />}
          </button>
        );
      })}
    </div>
  );
}

function PartPad({
  part,
  index,
  playing,
  queued,
  isNext,
  onPress,
}: {
  part: SongItem;
  index: number;
  playing: boolean;
  queued: boolean;
  isNext: boolean;
  onPress: () => void;
}) {
  const [down, setDown] = useState(false);
  const c = colorToHex(part.color) ?? "#7c7f88";
  return (
    <button
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onClick={onPress}
      aria-label={`Lanzar ${part.name}`}
      aria-pressed={playing}
      style={{
        position: "relative",
        minHeight: 104,
        borderRadius: 12,
        padding: "10px 12px",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        border: isNext ? "2px dashed rgba(255,178,62,0.7)" : "1px solid rgba(0,0,0,0.7)",
        background: playing
          ? `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${c} 50%, white) 0%, ${c} 55%, color-mix(in srgb, ${c} 70%, black) 100%)`
          : `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${c} 38%, #2a2c31) 0%, color-mix(in srgb, ${c} 20%, #1b1c20) 100%)`,
        boxShadow: down
          ? "inset 0 3px 8px rgba(0,0,0,0.7)"
          : playing
            ? `inset 0 1px 0 rgba(255,255,255,0.4), 0 0 26px color-mix(in srgb, ${c} 65%, transparent), 0 2px 4px rgba(0,0,0,0.6)`
            : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 3px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.55)",
        transform: down ? "scale(0.98)" : undefined,
        transition: "box-shadow 120ms var(--ease-instrument), background 120ms, transform 60ms",
      }}
    >
      <span className="flex items-center justify-between w-full">
        <span className="value-mono" style={{ fontSize: 11, fontWeight: 700, color: playing ? "rgba(0,0,0,0.6)" : "rgba(233,229,218,0.45)" }}>
          {index + 1}
        </span>
        {queued && <span className="beat-dot"><Led on color="cue" size={8} /></span>}
        {playing && <Led on color="white" size={8} />}
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "0.01em",
          lineHeight: 1.1,
          color: playing ? "rgba(8,8,10,0.88)" : "var(--color-text-1)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {part.name || "Sin nombre"}
      </span>
      {isNext && (
        <span className="label-cap" style={{ position: "absolute", top: 10, right: 12, fontSize: 9, color: "var(--color-accent-cue)" }}>
          Sigue
        </span>
      )}
    </button>
  );
}

function PartPicker({
  song,
  parts,
  initial,
  songForPos,
  onSave,
  onAuto,
  onCancel,
}: {
  song: SongItem;
  parts: SongItem[];
  initial: SongItem[];
  songForPos: (pos: number) => SongItem | null;
  onSave: (sel: SongItem[]) => void;
  onAuto: () => void;
  onCancel: () => void;
}) {
  const key = (p: SongItem) => p.key;
  // Ordered selection: pads follow the order you tap them in.
  const [sel, setSel] = useState<string[]>(() => initial.map(key));
  const toggle = (p: SongItem) =>
    setSel((s) => (s.includes(key(p)) ? s.filter((k) => k !== key(p)) : [...s, key(p)]));
  const byKey = new Map(parts.map((p) => [key(p), p]));

  return (
    <div className="mx-auto flex flex-col gap-3" style={{ maxWidth: 900 }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700 }}>Partes de {song.name}</span>
        <span style={{ fontSize: 13, color: "var(--color-text-2)" }}>Tócalas en el orden en que quieres los pads.</span>
        <div className="flex-1" />
        <LedKey size="sm" label="Ninguna" onClick={() => setSel([])} />
        <LedKey size="sm" label="Automático" onClick={onAuto} title="Usar los clips debajo de la canción" />
        <LedKey size="sm" label="Cancelar" onClick={onCancel} />
        <LedKey size="sm" color="play" active label={`Guardar (${sel.length})`} onClick={() => onSave(sel.map((k) => byKey.get(k)).filter((p): p is SongItem => !!p))} />
      </div>
      <div className="panel" style={{ padding: 8 }}>
        {parts.map((p) => {
          const order = sel.indexOf(key(p));
          const owner = songForPos(p.pos);
          const inSong = owner?.key === song.key;
          return (
            <button
              key={key(p)}
              onClick={() => toggle(p)}
              className="w-full flex items-center gap-3"
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                textAlign: "left",
                background: order >= 0 ? "rgba(255,178,62,0.1)" : "transparent",
                boxShadow: order >= 0 ? "inset 0 0 0 1px rgba(255,178,62,0.5)" : undefined,
                opacity: inSong || order >= 0 ? 1 : 0.6,
              }}
            >
              <span
                className="value-mono flex items-center justify-center shrink-0"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 700,
                  background: order >= 0 ? "var(--color-accent-cue)" : "#0d0e10",
                  color: order >= 0 ? "var(--color-text-inverse)" : "var(--color-text-3)",
                  boxShadow: order >= 0 ? "0 0 10px rgba(255,178,62,0.5)" : "var(--shadow-well)",
                }}
              >
                {order >= 0 ? order + 1 : ""}
              </span>
              <span style={{ width: 4, height: 22, borderRadius: 2, background: colorToHex(p.color) ?? "#777" }} />
              <span style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>{p.name || "Sin nombre"}</span>
              <span className="value-mono" style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                {p.source === "session" ? `escena ${p.scene + 1}` : `compás ${beatsToBarLabel(p.pos)}`}
                {owner && !inSong ? ` · ${owner.name}` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
