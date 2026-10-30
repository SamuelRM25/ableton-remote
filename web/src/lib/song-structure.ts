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

export interface SongConfig {
  /** Track NAMES (Live's internal ids change every time Live restarts). */
  songTrack: string;
  partsTrack: string;
  launch: "clip" | "scene";
  follow: boolean;
  /** Hand-picked parts per song, keyed by the song clip's name. */
  picks: Record<string, PartRef[]>;
}

const CONFIG_KEY = "ableton-remote.songpads.v1";
/** Same config, saved inside the Live set so every device sees it. */
const LIVE_DATA_KEY = "ableton-remote.songconfig.v1";
let liveClient: Ableton | null = null;

function loadConfig(): SongConfig {
  const empty: SongConfig = { songTrack: "", partsTrack: "", launch: "clip", follow: true, picks: {} };
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
        const merged: SongConfig = { ...current, ...doc, picks: doc.picks ?? current.picks };
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

export function useSongStructure(client: Ableton | null) {
  useLiveConfigSync(client);
  const rawTracks = useLiveRawList<any>("song", "tracks");
  const config = useStore(songStore, (s) => s.config);
  const selectedKey = useStore(songStore, (s) => s.selectedKey);
  const pendingKey = useStore(songStore, (s) => s.pendingKey);
  const clock = useSongClock(client);

  const trackByName = (name: string) =>
    name ? (rawTracks ?? []).find((t: any) => String(t.name ?? "").trim() === name.trim()) ?? null : null;
  const songTrack = trackByName(config.songTrack);
  const partsTrack = trackByName(config.partsTrack);
  const songTrackId: string | null = songTrack ? String(songTrack.id) : null;
  const partsTrackId: string | null = partsTrack ? String(partsTrack.id) : null;
  const configured = !!config.songTrack && !!config.partsTrack;
  const tracksMissing = configured && rawTracks !== null && (!songTrack || !partsTrack);

  const songsState = useTrackClips(client, songTrackId, config.songTrack);
  const partsState = useTrackClips(client, partsTrackId, config.partsTrack);
  const songs = songsState.kind === "ready" ? songsState.clips : null;
  const parts = partsState.kind === "ready" ? partsState.clips : null;
  const arrangement = songsState.kind === "ready" && songsState.source === "arrangement";

  // Session: Live tells us what plays. Arrangement: the playhead does.
  const songSlot = useTrackProp<number>(client, arrangement ? null : songTrackId, "playing_slot_index");
  const partSlot = useTrackProp<number>(client, arrangement ? null : partsTrackId, "playing_slot_index");
  const partFiredSlot = useTrackProp<number>(client, arrangement ? null : partsTrackId, "fired_slot_index");

  const t = clock.beats;
  const inRange = (c: SongItem, list: SongItem[]) => {
    const i = list.indexOf(c);
    const end = c.end ?? list[i + 1]?.pos ?? Number.POSITIVE_INFINITY;
    return t >= (c.start ?? c.pos) - 0.001 && t < end - 0.001;
  };

  const playingSong: SongItem | null = !songs
    ? null
    : arrangement
      ? songs.find((s) => inRange(s, songs)) ?? null
      : songs.find((s) => s.scene === songSlot) ?? null;

  const playingPart: SongItem | null = !parts
    ? null
    : arrangement
      ? (clock.isPlaying || t > 0 ? parts.find((p) => inRange(p, parts)) ?? null : null)
      : parts.find((p) => p.scene === partSlot) ?? null;

  const firedPart: SongItem | null = !parts
    ? null
    : arrangement
      ? parts.find((p) => p.key === pendingKey) ?? null
      : parts.find((p) => p.scene === partFiredSlot && p.scene !== partSlot) ?? null;

  /** The song a position belongs to (last song at or before it). */
  const songForPos = (pos: number): SongItem | null => {
    let found: SongItem | null = null;
    for (const s of songs ?? []) if (s.pos <= pos + 0.001) found = s;
    return found;
  };

  // Follow Live.
  useEffect(() => {
    if (!config.follow || !songs) return;
    const target = playingSong ?? (playingPart ? songForPos(playingPart.pos) : null);
    if (target && target.key !== songStore.getState().selectedKey) songStore.getState().select(target.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.follow, songs, playingSong?.key, playingPart?.key]);

  // Default to the first song.
  useEffect(() => {
    if (songs && songs.length > 0 && (selectedKey === null || !songs.some((s) => s.key === selectedKey))) {
      songStore.getState().select(songs[0].key);
    }
  }, [songs, selectedKey]);

  const song = songs?.find((s) => s.key === selectedKey) ?? null;
  const songIndex = song && songs ? songs.indexOf(song) : -1;
  const nextSong = songs && songIndex >= 0 ? songs[songIndex + 1] ?? null : null;

  const autoParts = useMemo(() => {
    if (!song || !parts) return [];
    const end = song.end ?? (nextSong ? nextSong.pos : Number.POSITIVE_INFINITY);
    return parts.filter((p) => p.pos >= song.pos - 0.001 && p.pos < end - 0.001);
  }, [song, nextSong, parts]);

  const picked = song ? config.picks[song.name] : undefined;
  const songParts: SongItem[] = useMemo(() => {
    if (!picked || !parts) return autoParts;
    const out: SongItem[] = [];
    for (const ref of picked) {
      const exact = parts.find((p) => Math.abs(p.pos - ref.scene) < 0.01 && p.name === ref.name);
      const byName = exact ?? parts.find((p) => p.name === ref.name && (!song || p.pos >= song.pos));
      if (byName) out.push(byName);
    }
    return out;
  }, [picked, parts, autoParts, song]);

  const playingIdx = playingPart ? songParts.findIndex((p) => p.key === playingPart.key) : -1;
  const currentPart = playingIdx >= 0 ? songParts[playingIdx] : null;
  const nextPart = playingIdx >= 0 ? songParts[playingIdx + 1] ?? null : null;
  const queuedPart = firedPart && songParts.some((p) => p.key === firedPart.key) ? firedPart : null;

  return {
    rawTracks,
    config,
    setConfig: (c: SongConfig) => songStore.getState().setConfig(c),
    select: (key: string | null) => songStore.getState().select(key),
    setPending: (key: string | null) => songStore.setState({ pendingKey: key }),
    configured,
    tracksMissing,
    songTrackFound: !!songTrack,
    partsTrackFound: !!partsTrack,
    songsState,
    partsState,
    songs,
    parts,
    arrangement,
    selectedKey,
    song,
    nextSong,
    songParts,
    picked: !!picked,
    playingSongKey: playingSong?.key ?? null,
    playingPartKey: playingPart?.key ?? null,
    firedPartKey: firedPart?.key ?? null,
    currentPart,
    nextPart,
    queuedPart,
    songForPos,
  };
}
