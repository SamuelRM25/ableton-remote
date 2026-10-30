/**
 * "Armar": build a setlist from the song clips in Live and time it.
 *
 * Length of each song = its MIDI clip in the Arrangement (end − start, in
 * beats) at that song's BPM. The BPM defaults to Live's current tempo and
 * can be set per song, since Live's API doesn't expose tempo automation.
 */
import { useState } from "react";
import type { Ableton } from "ableton-js";
import { colorToHex } from "../lib/color";
import { toast } from "../lib/toast";
import { formatDuration, useSongStructure, type SongItem } from "../lib/song-structure";
import { EmptyPanel, LedKey, ViewStrip } from "../components/hw";

export function SetlistBuilder({
  client,
  switcher,
  onConfigure,
}: {
  client: Ableton | null;
  switcher?: React.ReactNode;
  onConfigure: () => void;
}) {
  const st = useSongStructure(client);
  const { config, setConfig, allSongs, activeSetlist } = st;
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const entries = activeSetlist?.entries ?? [];
  const resolved = entries.map((e) => ({
    entry: e,
    song: allSongs?.find((s) => s.name === e.name && Math.abs(s.pos - e.pos) < 0.01) ?? allSongs?.find((s) => s.name === e.name) ?? null,
  }));
  const durations = resolved.map((r) => (r.song ? st.durationSec(r.song) : null));
  const total = durations.reduce<number>((a, d) => a + (d ?? 0), 0);
  const unknown = durations.filter((d) => d === null).length;
  const target = (activeSetlist?.targetMin ?? 0) * 60;

  const sameSong = (e: { name: string; pos: number }, s: SongItem) => e.name === s.name && Math.abs(e.pos - s.pos) < 0.01;
  /** 1-based positions of a song inside the setlist (empty = not in it). */
  const positionsOf = (s: SongItem) => entries.flatMap((e, i) => (sameSong(e, s) ? [i + 1] : []));
  /** Song filter: everything, not in THIS setlist, or not in ANY setlist. */
  const [filter, setFilter] = useState<"all" | "missing" | "free">("all");
  /** Other setlists (not the one being edited) that already have this song. */
  const otherListsWith = (s: SongItem) =>
    config.setlists.filter((l) => l.id !== activeSetlist?.id && l.entries.some((e) => sameSong(e, s)));
  const [flashKey, setFlashKey] = useState<string | null>(null);

  function ensureList() {
    return activeSetlist ?? st.createSetlist(`Setlist ${config.setlists.length + 1}`);
  }
  function add(s: SongItem) {
    const others = otherListsWith(s);
    if (others.length > 0) toast(`«${s.name}» también está en ${others.map((l) => `«${l.name}»`).join(", ")}`);
    setFlashKey(s.key);
    window.setTimeout(() => setFlashKey((k) => (k === s.key ? null : k)), 900);
    const l = ensureList();
    const next = [...(l.id === activeSetlist?.id ? entries : l.entries), { name: s.name, pos: s.pos }];
    if (l.id === activeSetlist?.id) st.updateSetlist(l.id, (x) => ({ ...x, entries: next }));
    else setConfig({ ...config, setlists: [...config.setlists.filter((x) => x.id !== l.id), { ...l, entries: next }], activeSetlist: l.id });
  }
  function move(i: number, d: -1 | 1) {
    if (!activeSetlist) return;
    const j = i + d;
    if (j < 0 || j >= entries.length) return;
    const next = [...entries];
    [next[i], next[j]] = [next[j], next[i]];
    st.updateSetlist(activeSetlist.id, (x) => ({ ...x, entries: next }));
  }
  /** Take a song out of the setlist (its last appearance). */
  function removeSong(s: SongItem) {
    if (!activeSetlist) return;
    const last = entries.map((e, i) => (sameSong(e, s) ? i : -1)).filter((i) => i >= 0).pop();
    if (last !== undefined) remove(last);
  }

  function remove(i: number) {
    if (!activeSetlist) return;
    st.updateSetlist(activeSetlist.id, (x) => ({ ...x, entries: entries.filter((_, k) => k !== i) }));
  }
  function setBpm(name: string, v: number | null) {
    const bpm = { ...config.bpm };
    if (v === null || !(v > 0)) delete bpm[name];
    else bpm[name] = v;
    setConfig({ ...config, bpm });
  }

  if (!st.configured || !config.songTrack) {
    return (
      <div className="h-full flex flex-col">
        <ViewStrip>{switcher}</ViewStrip>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <EmptyPanel title="Primero elige tu pista de canciones" hint="La pista MIDI donde cada clip es una canción. Se configura en «En vivo» → Pistas." />
          <LedKey size="md" color="cue" active label="Configurar pistas" onClick={onConfigure} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ViewStrip className="flex-wrap py-2">
        {switcher}
        <div className="flex-1" />
        <select
          value={activeSetlist?.id ?? ""}
          onChange={(e) => setConfig({ ...config, activeSetlist: e.target.value || null })}
          aria-label="Setlist"
          style={{ border: "1px solid rgba(0,0,0,0.6)", borderRadius: 6, padding: "7px 10px", fontSize: 14, maxWidth: 220 }}
        >
          <option value="">Orden del set (sin setlist)</option>
          {config.setlists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <LedKey size="sm" color="play" label="+ Nuevo" onClick={() => st.createSetlist(`Setlist ${config.setlists.length + 1}`)} />
        {activeSetlist && (
          <>
            <LedKey
              size="sm"
              label="Renombrar"
              onClick={() => {
                setNameDraft(activeSetlist.name);
                setRenaming(true);
              }}
            />
            <LedKey
              size="sm"
              color="critical"
              label="Borrar"
              onClick={() => {
                if (window.confirm(`¿Borrar «${activeSetlist.name}»? Las canciones de Live no se tocan.`)) st.deleteSetlist(activeSetlist.id);
              }}
            />
          </>
        )}
      </ViewStrip>

      {renaming && activeSetlist && (
        <div className="shrink-0 px-3 sm:px-5 pt-3">
          <div className="panel flex items-center gap-2" style={{ padding: 12 }}>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  st.updateSetlist(activeSetlist.id, (x) => ({ ...x, name: nameDraft.trim() || x.name }));
                  setRenaming(false);
                }
              }}
              autoFocus
              aria-label="Nombre del setlist"
              className="well flex-1"
              style={{ padding: "8px 10px", fontSize: 15, border: "1px solid var(--color-accent-cue)" }}
            />
            <LedKey
              size="sm"
              color="play"
              active
              label="Guardar"
              onClick={() => {
                st.updateSetlist(activeSetlist.id, (x) => ({ ...x, name: nameDraft.trim() || x.name }));
                setRenaming(false);
              }}
            />
            <LedKey size="sm" label="Cancelar" onClick={() => setRenaming(false)} />
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto scroll-touch p-3 sm:p-5">
        <div className="grid gap-4 mx-auto" style={{ maxWidth: 1200, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
          {/* ---------------- The setlist ---------------- */}
          <section className="panel flex flex-col" style={{ padding: 14 }}>
            <header className="flex items-end gap-3 flex-wrap" style={{ marginBottom: 12 }}>
              <div className="flex-1 min-w-0">
                <div className="label-cap" style={{ fontSize: 10 }}>{activeSetlist ? "Setlist" : "Sin setlist"}</div>
                <div className="truncate" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22 }}>
                  {activeSetlist?.name ?? "Agrega canciones para crear uno"}
                </div>
              </div>
              <div className="vfd flex items-end gap-4" style={{ padding: "8px 14px" }}>
                <div>
                  <div className="seg" style={{ fontSize: 30, lineHeight: 1 }}>{formatDuration(total)}</div>
                  <div style={vfdCaption}>Total{unknown > 0 ? ` (+${unknown} sin medir)` : ""}</div>
                </div>
                {target > 0 && (
                  <div>
                    <div
                      className="seg"
                      style={{
                        fontSize: 20,
                        lineHeight: 1,
                        color: total > target ? "var(--color-accent-rec)" : "var(--color-accent-play)",
                        textShadow: "none",
                      }}
                    >
                      {total > target ? "+" : "-"}
                      {formatDuration(Math.abs(target - total))}
                    </div>
                    <div style={vfdCaption}>{total > target ? "Te pasas" : "Te sobra"}</div>
                  </div>
                )}
              </div>
            </header>

            {activeSetlist && (
              <label className="flex items-center gap-2" style={{ marginBottom: 12, fontSize: 13, color: "var(--color-text-2)" }}>
                Tiempo disponible
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={activeSetlist.targetMin || ""}
                  placeholder="—"
                  onChange={(e) => st.updateSetlist(activeSetlist.id, (x) => ({ ...x, targetMin: Math.max(0, Number(e.target.value) || 0) }))}
                  className="well value-mono"
                  style={{ width: 72, padding: "6px 8px", fontSize: 14, textAlign: "center", border: "1px solid rgba(0,0,0,0.6)" }}
                />
                minutos
              </label>
            )}

            {entries.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-2)", lineHeight: 1.5 }}>
                Toca <strong>+</strong> en las canciones de la derecha para armar el orden. En «En vivo», la tira de canciones, ◀ / ▶▶ y «Encadenar» siguen este orden.
              </p>
            ) : (
              <ol className="flex flex-col gap-1.5" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {resolved.map((r, i) => {
                  const startsAt = durations.slice(0, i).reduce<number>((a, d) => a + (d ?? 0), 0);
                  return (
                    <li
                      key={`${r.entry.name}-${i}`}
                      className="flex items-center gap-2"
                      style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.18)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)" }}
                    >
                      <span className="value-mono shrink-0" style={{ width: 22, fontSize: 12, color: "var(--color-accent-cue)" }}>
                        {i + 1}
                      </span>
                      <span style={{ width: 4, height: 26, borderRadius: 2, background: colorToHex(r.song?.color ?? null) ?? "#666" }} />
                      <span className="flex-1 min-w-0">
                        <span className="truncate block" style={{ fontSize: 15, fontWeight: 600, color: r.song ? undefined : "var(--color-critical)" }}>
                          {r.entry.name}
                        </span>
                        <span className="value-mono" style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                          {r.song ? `empieza en ${formatDuration(startsAt)}` : "ya no está en Live"}
                        </span>
                      </span>
                      <span className="value-mono shrink-0" style={{ fontSize: 13, color: "var(--color-text-1)" }}>
                        {durations[i] !== null ? formatDuration(durations[i]!) : "—"}
                      </span>
                      <LedKey size="xs" label="▲" onClick={() => move(i, -1)} disabled={i === 0} title="Subir" />
                      <LedKey size="xs" label="▼" onClick={() => move(i, 1)} disabled={i === entries.length - 1} title="Bajar" />
                      <LedKey size="xs" color="critical" label="✕" onClick={() => remove(i)} title="Quitar del setlist" />
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* ---------------- Songs in Live ---------------- */}
          <section className="panel flex flex-col" style={{ padding: 14 }}>
            <header className="flex items-center gap-2" style={{ marginBottom: 12 }}>
              <div className="flex-1">
                <div className="label-cap" style={{ fontSize: 10 }}>
                  Canciones en «{config.songTrack}»
                  {allSongs && ` · ${allSongs.filter((x) => positionsOf(x).length > 0).length} de ${allSongs.length} en el setlist`}
                </div>
                <div style={{ fontSize: 13, color: "var(--color-text-2)" }}>
                  Duración = largo del clip MIDI ÷ BPM. Pon el BPM de cada canción si no es el actual ({Math.round(st.clock.tempo * 100) / 100}).
                </div>
              </div>
              <LedKey
                size="sm"
                variant="dot"
                color="cue"
                active={filter === "missing"}
                label="Faltan"
                title="Solo las que no están en este setlist"
                onClick={() => setFilter((f) => (f === "missing" ? "all" : "missing"))}
              />
              <LedKey
                size="sm"
                variant="dot"
                color="link"
                active={filter === "free"}
                label="Sin usar"
                title="Solo las que no están en ningún setlist"
                onClick={() => setFilter((f) => (f === "free" ? "all" : "free"))}
              />
              <LedKey
                size="sm"
                label="Todas"
                title="Poner todas en el setlist, en el orden del set"
                disabled={!allSongs || allSongs.length === 0}
                onClick={() => {
                  if (!allSongs) return;
                  const l = activeSetlist ?? st.createSetlist(`Setlist ${config.setlists.length + 1}`);
                  const list = allSongs.map((s) => ({ name: s.name, pos: s.pos }));
                  setConfig({
                    ...config,
                    setlists: [...config.setlists.filter((x) => x.id !== l.id), { ...l, entries: list }],
                    activeSetlist: l.id,
                  });
                  toast(`${list.length} canciones en ${l.name}`);
                }}
              />
            </header>
            {!allSongs ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-2)" }}>Leyendo clips de Live…</p>
            ) : allSongs.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-2)" }}>No hay clips en esa pista.</p>
            ) : (
              <ul className="flex flex-col gap-1.5" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {allSongs
                  .filter((s) =>
                    filter === "missing"
                      ? positionsOf(s).length === 0
                      : filter === "free"
                        ? positionsOf(s).length === 0 && otherListsWith(s).length === 0
                        : true,
                  )
                  .map((s) => {
                  const others = otherListsWith(s);
                  const d = st.durationSec(s);
                  const pos = positionsOf(s);
                  const added = pos.length > 0;
                  const flash = flashKey === s.key;
                  return (
                    <li
                      key={s.key}
                      className="flex items-center gap-2"
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: flash
                          ? "rgba(57,242,138,0.22)"
                          : added
                            ? "linear-gradient(90deg, rgba(255,178,62,0.22), rgba(255,178,62,0.06))"
                            : "rgba(0,0,0,0.18)",
                        boxShadow: added ? "inset 0 0 0 1.5px rgba(255,178,62,0.75)" : "inset 0 0 0 1px rgba(255,255,255,0.04)",
                        transition: "background 300ms var(--ease-instrument)",
                      }}
                    >
                      {/* Setlist position badge: you see at a glance what's in and where */}
                      <span
                        className="value-mono shrink-0 flex items-center justify-center"
                        title={added ? `Posición ${pos.join(", ")} del setlist` : "No está en el setlist"}
                        style={{
                          minWidth: 30,
                          height: 26,
                          padding: "0 6px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          background: added ? "var(--color-accent-cue)" : "#0d0e10",
                          color: added ? "var(--color-text-inverse)" : "var(--color-text-3)",
                          boxShadow: added ? "0 0 10px rgba(255,178,62,0.5)" : "var(--shadow-well)",
                        }}
                      >
                        {added ? pos.map((n) => `#${n}`).join(" ") : "—"}
                      </span>
                      <span style={{ width: 4, height: 26, borderRadius: 2, background: colorToHex(s.color) ?? "#666" }} />
                      <span className="flex-1 min-w-0">
                        <span className="truncate block" style={{ fontSize: 15, fontWeight: 600 }}>{s.name || "Sin nombre"}</span>
                        <span className="value-mono" style={{ fontSize: 11, color: "var(--color-text-3)" }}>
                          {s.source === "arrangement" && st.songBeats(s) !== null
                            ? `${Math.round((st.songBeats(s)! * st.clock.beatUnit) / 4 / st.clock.beatsPerBar)} compases`
                            : "Session: sin largo"}
                        </span>
                        {/* Which OTHER setlists already use this song */}
                        {others.length > 0 && (
                          <span className="flex flex-wrap gap-1" style={{ marginTop: 4 }}>
                            {others.map((l) => (
                              <button
                                key={l.id}
                                onClick={() => setConfig({ ...config, activeSetlist: l.id })}
                                title={`Abrir «${l.name}»`}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: 999,
                                  color: "var(--color-accent-link)",
                                  background: "rgba(95,212,244,0.1)",
                                  boxShadow: "inset 0 0 0 1px rgba(95,212,244,0.45)",
                                  maxWidth: 180,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                En «{l.name}» #{l.entries.findIndex((e) => sameSong(e, s)) + 1}
                              </button>
                            ))}
                          </span>
                        )}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={20}
                        max={999}
                        step="0.01"
                        value={config.bpm[s.name] ?? ""}
                        placeholder={String(Math.round(st.clock.tempo))}
                        onChange={(e) => setBpm(s.name, e.target.value === "" ? null : Number(e.target.value))}
                        aria-label={`BPM de ${s.name}`}
                        className="well value-mono"
                        style={{ width: 64, padding: "5px 6px", fontSize: 13, textAlign: "center", border: "1px solid rgba(0,0,0,0.6)" }}
                      />
                      <span className="label-cap" style={{ fontSize: 9 }}>BPM</span>
                      <span className="value-mono shrink-0" style={{ width: 52, textAlign: "right", fontSize: 13 }}>
                        {d !== null ? formatDuration(d) : "—"}
                      </span>
                      {added ? (
                        <>
                          <LedKey size="sm" color="critical" label="−" onClick={() => removeSong(s)} title="Quitar del setlist" width={36} />
                          <LedKey size="sm" label="+" onClick={() => add(s)} title="Agregarla otra vez (si se toca dos veces en el set)" width={36} />
                        </>
                      ) : (
                        <LedKey size="sm" color="play" label="+" onClick={() => add(s)} title="Agregar al setlist" width={36} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

const vfdCaption: React.CSSProperties = {
  marginTop: 5,
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-vfd-ink)",
  opacity: 0.6,
};
