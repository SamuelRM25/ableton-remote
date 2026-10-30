/**
 * Song structure shared by the "Canción" view and the Stage view.
 *
 * The set is organised with:
 *   - a SONG track: one (usually empty) MIDI clip per song, named after it;
 *   - a PARTS track: empty MIDI clips named after each part (Intro, Verso…),
 *     in the scenes below their song's clip.
 *
 * The parts of a song are, by default, the PARTS-track clips from the
 * song's scene down to the next song. Any song can override that with a
 * hand-picked, ordered list.
 */
import { useEffect, useMemo, useState } from "react";
import type { Ableton } from "ableton-js";
import { createStore, useStore } from "./store";
import { useLiveRawList } from "./list-hooks";
import { useSongClock } from "./clock";

/* ------------------------------------------------------------------ */
/* Config (persisted) + current selection (shared by every view)       */
/* ------------------------------------------------------------------ */

export interface PartRef {
  name: string;
  /** Position: scene index (Session) or start in beats (Arrangement). */
  scene: number;
}

export interface SetlistEntry {
  name: string;
  /** Position of the song clip when it was added (scene or start beat). */
  pos: number;
}

export interface Setlist {
  id: string;
  name: string;
  entries: SetlistEntry[];
  /** Target length in minutes (0 = none). */
  targetMin: number;
}

export interface SongConfig {
  /** Track NAMES (Live's internal ids change every time Live restarts). */
  songTrack: string;
  partsTrack: string;
  /** Where the parts of a song come from: a MIDI track, or Live's locators. */
  partsSource: "track" | "cues";
  launch: "clip" | "scene";
  follow: boolean;
  /** At the end of a song, jump straight to the next one in the setlist. */
  chain: boolean;
  /** Hand-picked parts per song, keyed by the song clip's name. */
  picks: Record<string, PartRef[]>;
  /** BPM per song, used to turn its length in beats into minutes. */
  bpm: Record<string, number>;
  setlists: Setlist[];
  activeSetlist: string | null;
}

const CONFIG_KEY = "ableton-remote.songpads.v1";
/** Same config, saved inside the Live set so every device sees it. */
const LIVE_DATA_KEY = "ableton-remote.songconfig.v1";
let liveClient: Ableton | null = null;

function loadConfig(): SongConfig {
  const empty: SongConfig = {
    songTrack: "",
    partsTrack: "",
    partsSource: "track",
    launch: "clip",
    follow: true,
    chain: false,
    picks: {},
    bpm: {},
    setlists: [],
    activeSetlist: null,
  };
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? { ...empty, ...(JSON.parse(raw) as Partial<SongConfig>) } : empty;
  } catch {
    return empty;
  }
}

interface SongStore {
  config: SongConfig;
  /** Key of the selected song clip. */
  selectedKey: string | null;
  /** Arrangement mode: part we're about to jump to (waiting for the 1). */
  pendingKey: string | null;
  setConfig(c: SongConfig): void;
  select(key: string | null): void;
}

export const songStore = createStore<SongStore>((set) => ({
  config: loadConfig(),
  selectedKey: null,
  pendingKey: null,
  setConfig(c) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
    } catch {
      // storage unavailable — config lives for this session only
    }
    set({ config: c });
    // Also store it in the Live set (saved with the .als), so a second
    // iPad or phone — e.g. the Stage screen — uses the same tracks/parts.
    if (liveClient) void liveClient.song.setData(LIVE_DATA_KEY, c as any).catch(() => {});
  },
  select(key) {
    set({ selectedKey: key });
  },
}));

/* ------------------------------------------------------------------ */
/* Live data                                                           */
/* ------------------------------------------------------------------ */

/**
 * One song or part clip. Works for both places a clip can live:
 *   - Session: `scene` = row index, launched by firing its slot.
 *   - Arrangement: `start`/`end` in beats, "launched" by moving the playhead.
 */
export interface SongItem {
  key: string;
  name: string;
  color: number | null;
  source: "session" | "arrangement";
  /** Sort position: scene index (Session) or start beat (Arrangement). */
  pos: number;
  /** Session row (−1 in Arrangement). */
  scene: number;
  /** Arrangement range in beats (undefined in Session). */
  start?: number;
  end?: number;
  slot_id?: string;
}

/** Kept for older imports. */
export type SessionClip = SongItem;

export type ClipsState =
  | { kind: "loading"; since: number }
  | { kind: "ready"; clips: SongItem[]; source: "session" | "arrangement" | "none" }
  | { kind: "error"; message: string };

interface CacheEntry {
  clips: SongItem[];
  source: "session" | "arrangement" | "none";
}

/** Last good reading per track name, so switching views is instant. */
const clipCache = new Map<string, CacheEntry>();

const READ_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise((res, rej) => {
    const t = window.setTimeout(() => rej(new Error(`Live tardó más de ${ms / 1000} s en ${what}`)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        res(v);
      },
      (e) => {
        window.clearTimeout(t);
        rej(e);
      },
    );
  });
}

/**
 * Every clip on one track: the Session column first; if it has none, the
 * Arrangement. Never overlaps reads, keeps the last good list while
 * refreshing, and always resolves to ready/error (an EMPTY track used to
 * leave the view stuck on "Leyendo clips…" forever).
 */
export function useTrackClips(client: Ableton | null, trackId: string | null, trackName: string): ClipsState {
  const [state, setState] = useState<ClipsState>(() => {
    const cached = clipCache.get(trackName);
    return cached ? { kind: "ready", ...cached } : { kind: "loading", since: Date.now() };
  });

  useEffect(() => {
    const cached = clipCache.get(trackName);
    setState(cached ? { kind: "ready", ...cached } : { kind: "loading", since: Date.now() });
  }, [trackName]);

  useEffect(() => {
    if (!client || !trackId) return;
    let cancelled = false;
    let inFlight = false;
    let lastSig: string | null = null;
    let failures = 0;

    const readSession = async (): Promise<SongItem[]> => {
      let list: any[] | null = null;
      try {
        const r = await client.getProp("track", trackId, "session_clips");
        if (Array.isArray(r)) list = r;
      } catch {
        // older MIDI script without session_clips
      }
      if (!list) {
        const slots: any[] = await client.getProp("track", trackId, "clip_slots");
        const withClip = slots.map((s, i) => ({ s, i })).filter(({ s }) => s?.has_clip);
        const clips = await Promise.all(
          withClip.map(({ s }) => client.getProp("clip_slot", String(s.id), "clip").catch(() => null)),
        );
        list = [];
        withClip.forEach(({ s, i }, k) => {
          const c = clips[k];
          if (c) list!.push({ scene: i, name: c.name, color: c.color, slot_id: String(s.id) });
        });
      }
      return list.map((c) => ({
        key: `s:${c.scene}:${c.name ?? ""}`,
        name: String(c.name ?? ""),
        color: typeof c.color === "number" ? c.color : null,
        source: "session" as const,
        pos: Number(c.scene),
        scene: Number(c.scene),
        slot_id: String(c.slot_id),
      }));
    };

    const readArrangement = async (): Promise<SongItem[]> => {
      const r = await client.getProp("track", trackId, "arrangement_clips");
      const list: any[] = Array.isArray(r) ? r : [];
      return list
        .map((c) => ({
          key: `a:${Number(c.start_time).toFixed(3)}:${c.name ?? ""}`,
          name: String(c.name ?? ""),
          color: typeof c.color === "number" ? c.color : null,
          source: "arrangement" as const,
          pos: Number(c.start_time),
          scene: -1,
          start: Number(c.start_time),
          end: Number(c.end_time),
        }))
        .sort((a, b) => a.pos - b.pos);
    };

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        let clips = await withTimeout(readSession(), READ_TIMEOUT_MS, "leer la Session");
        let source: CacheEntry["source"] = "session";
        if (clips.length === 0) {
          clips = await withTimeout(readArrangement(), READ_TIMEOUT_MS, "leer el Arreglo").catch(() => []);
          source = clips.length > 0 ? "arrangement" : "none";
        }
        if (cancelled) return;
        failures = 0;
        const sig = source + "|" + clips.map((c) => `${c.key}:${c.color}:${c.end ?? ""}`).join("|");
        if (sig !== lastSig) {
          lastSig = sig;
          clipCache.set(trackName, { clips, source });
          setState({ kind: "ready", clips, source });
        }
      } catch (err) {
        if (cancelled) return;
        failures += 1;
        console.warn(`[Canción] No se pudieron leer los clips de «${trackName}»`, err);
        if (!clipCache.get(trackName) && failures >= 1) {
          setState({ kind: "error", message: err instanceof Error ? err.message : "Live no respondió" });
        }
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const timer = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client, trackId, trackName]);

  return state;
}

/** One listenable prop of a track, by raw id. */
export function useTrackProp<T>(client: Ableton | null, trackId: string | null, prop: string): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    if (!client || !trackId) {
      setValue(undefined);
      return;
    }
    let cancelled = false;
    let off: (() => Promise<unknown>) | null = null;
    (async () => {
      try {
        const v = await client.getProp("track", trackId, prop);
        if (!cancelled) setValue(v as T);
        const unsub = await client.addPropListener("track", trackId, prop, (next: T) => {
          if (!cancelled) setValue(next);
        });
        if (cancelled) void unsub().catch(() => {});
        else off = unsub;
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
      if (off) void off().catch(() => {});
    };
  }, [client, trackId, prop]);
  return value;
}

/** Pull the config saved in the Live set (on connect, then every 10 s). */
function useLiveConfigSync(client: Ableton | null) {
  useEffect(() => {
    liveClient = client;
    if (!client) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const doc = (await client.song.getData(LIVE_DATA_KEY)) as Partial<SongConfig> | null;
        if (cancelled || !doc || typeof doc !== "object" || !doc.songTrack) return;
        const current = songStore.getState().config;
        const merged: SongConfig = {
          ...current,
          ...doc,
          picks: doc.picks ?? current.picks,
          bpm: doc.bpm ?? current.bpm,
          setlists: doc.setlists ?? current.setlists,
        };
        if (JSON.stringify(merged) !== JSON.stringify(current)) {
          try {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
          } catch {
            // ignore
          }
          songStore.setState({ config: merged });
        }
      } catch {
        // older set without data — keep the local config
      }
    };
    void pull();
    const timer = window.setInterval(pull, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client]);
}

/* ------------------------------------------------------------------ */
/* Everything a view needs                                             */
/* ------------------------------------------------------------------ */

/** Live's locators, re-read every few seconds (renames have no listener). */
function useCuePoints(client: Ableton | null, enabled: boolean): SongItem[] | null {
  const [cues, setCues] = useState<SongItem[] | null>(null);
  useEffect(() => {
    if (!client || !enabled) return;
    let cancelled = false;
    let sig: string | null = null;
    const read = async () => {
      try {
        const list: any[] = await client.getProp("song", undefined, "cue_points");
        if (cancelled || !Array.isArray(list)) return;
        const items = list
          .map((c) => ({
            key: `c:${Number(c.time).toFixed(3)}:${c.name ?? ""}`,
            name: String(c.name || "Marca"),
            color: null,
            source: "arrangement" as const,
            pos: Number(c.time),
            scene: -1,
            start: Number(c.time),
          }))
          .sort((a, b) => a.pos - b.pos);
        const next = items.map((c) => c.key).join("|");
        if (next !== sig) {
          sig = next;
          setCues(items);
        }
      } catch {
        if (!cancelled) setCues((prev) => prev ?? []);
      }
    };
    void read();
    const t = window.setInterval(read, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [client, enabled]);
  return cues;
}

/** m:ss for a duration in seconds. */
export function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "—";
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function useSongStructure(client: Ableton | null) {
  useLiveConfigSync(client);
  const rawTracks = useLiveRawList<any>("song", "tracks");
  const config = useStore(songStore, (s) => s.config);
  const selectedKey = useStore(songStore, (s) => s.selectedKey);
  const pendingKey = useStore(songStore, (s) => s.pendingKey);
  const clock = useSongClock(client);
  const setConfig = (c: SongConfig) => songStore.getState().setConfig(c);

  const trackByName = (name: string) =>
    name ? (rawTracks ?? []).find((t: any) => String(t.name ?? "").trim() === name.trim()) ?? null : null;
  const useCues = config.partsSource === "cues";
  const songTrack = trackByName(config.songTrack);
  const partsTrack = useCues ? null : trackByName(config.partsTrack);
  const songTrackId: string | null = songTrack ? String(songTrack.id) : null;
  const partsTrackId: string | null = partsTrack ? String(partsTrack.id) : null;
  const configured = !!config.songTrack && (useCues || !!config.partsTrack);
  const tracksMissing = configured && rawTracks !== null && (!songTrack || (!useCues && !partsTrack));

  const songsState = useTrackClips(client, songTrackId, config.songTrack);
  const partsTrackState = useTrackClips(client, useCues ? null : partsTrackId, useCues ? "" : config.partsTrack);
  const cueParts = useCuePoints(client, useCues && configured);
  const partsState: ClipsState = useCues
    ? cueParts
      ? { kind: "ready", clips: cueParts, source: "arrangement" }
      : { kind: "loading", since: Date.now() }
    : partsTrackState;

  const allSongs = songsState.kind === "ready" ? songsState.clips : null;
  const parts = partsState.kind === "ready" ? partsState.clips : null;
  const arrangement = songsState.kind === "ready" && songsState.source === "arrangement";
  const partsArrangement = useCues || (partsState.kind === "ready" && partsState.source === "arrangement");

  // ---- Setlist: the order you'll play the songs in -----------------
  const activeSetlist = config.setlists.find((l) => l.id === config.activeSetlist) ?? null;
  const resolveEntry = (e: SetlistEntry): SongItem | null =>
    allSongs?.find((s) => s.name === e.name && Math.abs(s.pos - e.pos) < 0.01) ??
    allSongs?.find((s) => s.name === e.name) ??
    null;
  const setSongs: SongItem[] = useMemo(
    () => (activeSetlist && allSongs ? activeSetlist.entries.map(resolveEntry).filter((s): s is SongItem => !!s) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeSetlist, allSongs],
  );
  /** Songs in performance order: the active setlist, or the set's own order. */
  const songs: SongItem[] | null = allSongs ? (activeSetlist && setSongs.length > 0 ? setSongs : allSongs) : null;

  const bpmOf = (s: SongItem) => config.bpm[s.name] ?? clock.tempo;
  /** Song length in beats: its clip in the Arrangement, else up to the next song. */
  const songBeats = (s: SongItem): number | null => {
    if (s.source !== "arrangement") return null;
    if (s.end !== undefined) return s.end - s.pos;
    const sorted = allSongs ?? [];
    const next = sorted[sorted.indexOf(s) + 1];
    return next ? next.pos - s.pos : null;
  };
  const durationSec = (s: SongItem): number | null => {
    const b = songBeats(s);
    return b === null ? null : (b * 60) / bpmOf(s);
  };

  // Session: Live tells us what plays. Arrangement: the playhead does.
  const songSlot = useTrackProp<number>(client, arrangement ? null : songTrackId, "playing_slot_index");
  const partSlot = useTrackProp<number>(client, partsArrangement ? null : partsTrackId, "playing_slot_index");
  const partFiredSlot = useTrackProp<number>(client, partsArrangement ? null : partsTrackId, "fired_slot_index");

  const t = clock.beats;
  const inRange = (c: SongItem, list: SongItem[]) => {
    const sorted = list;
    const i = sorted.indexOf(c);
    const end = c.end ?? sorted[i + 1]?.pos ?? Number.POSITIVE_INFINITY;
    return t >= (c.start ?? c.pos) - 0.001 && t < end - 0.001;
  };

  const playingSong: SongItem | null = !allSongs
    ? null
    : arrangement
      ? allSongs.find((s) => inRange(s, allSongs)) ?? null
      : allSongs.find((s) => s.scene === songSlot) ?? null;

  const playingPart: SongItem | null = !parts
    ? null
    : partsArrangement
      ? (clock.isPlaying || t > 0 ? parts.find((p) => inRange(p, parts)) ?? null : null)
      : parts.find((p) => p.scene === partSlot) ?? null;

  const firedPart: SongItem | null = !parts
    ? null
    : partsArrangement
      ? parts.find((p) => p.key === pendingKey) ?? null
      : parts.find((p) => p.scene === partFiredSlot && p.scene !== partSlot) ?? null;

  /** The song a position belongs to (by the song clips' own order). */
  const songForPos = (pos: number): SongItem | null => {
    let found: SongItem | null = null;
    for (const s of allSongs ?? []) if (s.pos <= pos + 0.001) found = s;
    return found;
  };

  // Follow Live.
  useEffect(() => {
    if (!config.follow || !allSongs) return;
    const target = playingSong ?? (playingPart ? songForPos(playingPart.pos) : null);
    if (target && target.key !== songStore.getState().selectedKey) songStore.getState().select(target.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.follow, allSongs, playingSong?.key, playingPart?.key]);

  // Default to the first song.
  useEffect(() => {
    if (songs && songs.length > 0 && (selectedKey === null || !allSongs?.some((s) => s.key === selectedKey))) {
      songStore.getState().select(songs[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, selectedKey]);

  const song = allSongs?.find((s) => s.key === selectedKey) ?? null;
  const orderIndex = song && songs ? songs.findIndex((s) => s.key === song.key) : -1;
  const nextSong = songs && orderIndex >= 0 ? songs[orderIndex + 1] ?? null : null;
  const prevSong = songs && orderIndex > 0 ? songs[orderIndex - 1] : null;

  const songEnd = (s: SongItem) => {
    if (s.end !== undefined) return s.end;
    const i = (allSongs ?? []).indexOf(s);
    return allSongs?.[i + 1]?.pos ?? Number.POSITIVE_INFINITY;
  };

  const autoParts = useMemo(() => {
    if (!song || !parts) return [];
    const end = songEnd(song);
    return parts
      .filter((p) => p.pos >= song.pos - 0.001 && p.pos < end - 0.001)
      .map((p, i, arr) =>
        // Locators have no end: a part runs until the next one (or the song's end).
        p.end === undefined && p.source === "arrangement"
          ? { ...p, end: arr[i + 1]?.pos ?? end, color: p.color ?? song.color }
          : p,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, parts, allSongs]);

  const picked = song ? config.picks[song.name] : undefined;
  const songParts: SongItem[] = useMemo(() => {
    if (!picked || !parts) return autoParts;
    const out: SongItem[] = [];
    for (const ref of picked) {
      const exact = autoParts.find((p) => Math.abs(p.pos - ref.scene) < 0.01 && p.name === ref.name) ??
        parts.find((p) => Math.abs(p.pos - ref.scene) < 0.01 && p.name === ref.name);
      const byName = exact ?? parts.find((p) => p.name === ref.name && (!song || p.pos >= song.pos));
      if (byName) out.push(byName);
    }
    return out;
  }, [picked, parts, autoParts, song]);

  const playingIdx = playingPart ? songParts.findIndex((p) => p.key === playingPart.key) : -1;
  const currentPart = playingIdx >= 0 ? songParts[playingIdx] : null;
  const nextPart = playingIdx >= 0 ? songParts[playingIdx + 1] ?? null : null;
  const queuedPart = firedPart && songParts.some((p) => p.key === firedPart.key) ? firedPart : null;

  // ---- Setlist editing helpers --------------------------------------
  const updateSetlist = (id: string, fn: (l: Setlist) => Setlist) =>
    setConfig({ ...config, setlists: config.setlists.map((l) => (l.id === id ? fn(l) : l)) });
  const createSetlist = (name: string, entries: SetlistEntry[] = []) => {
    const l: Setlist = { id: `sl-${Date.now().toString(36)}`, name, entries, targetMin: 0 };
    setConfig({ ...config, setlists: [...config.setlists, l], activeSetlist: l.id });
    return l;
  };
  const deleteSetlist = (id: string) => {
    const rest = config.setlists.filter((l) => l.id !== id);
    setConfig({ ...config, setlists: rest, activeSetlist: config.activeSetlist === id ? rest[0]?.id ?? null : config.activeSetlist });
  };

  return {
    rawTracks,
    clock,
    config,
    setConfig,
    select: (key: string | null) => songStore.getState().select(key),
    setPending: (key: string | null) => songStore.setState({ pendingKey: key }),
    configured,
    tracksMissing,
    songTrackFound: !!songTrack,
    partsTrackFound: useCues || !!partsTrack,
    songsState,
    partsState,
    allSongs,
    songs,
    parts,
    arrangement,
    partsArrangement,
    selectedKey,
    song,
    nextSong,
    prevSong,
    songParts,
    picked: !!picked,
    playingSongKey: playingSong?.key ?? null,
    playingSong,
    playingPartKey: playingPart?.key ?? null,
    firedPartKey: firedPart?.key ?? null,
    currentPart,
    nextPart,
    queuedPart,
    songForPos,
    songEnd,
    // setlist
    activeSetlist,
    setSongs,
    updateSetlist,
    createSetlist,
    deleteSetlist,
    durationSec,
    songBeats,
    bpmOf,
  };
}
