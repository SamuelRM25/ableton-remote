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

/* ------------------------------------------------------------------ */
/* Config (persisted) + current selection (shared by every view)       */
/* ------------------------------------------------------------------ */

export interface PartRef {
  name: string;
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
  selectedScene: number | null;
  setConfig(c: SongConfig): void;
  select(scene: number | null): void;
}

export const songStore = createStore<SongStore>((set) => ({
  config: loadConfig(),
  selectedScene: null,
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
  select(scene) {
    set({ selectedScene: scene });
  },
}));

/* ------------------------------------------------------------------ */
/* Live data                                                           */
/* ------------------------------------------------------------------ */

export interface SessionClip {
  scene: number;
  name: string;
  color: number | null;
  clip_id: string;
  slot_id: string;
}

export type ClipsState =
  | { kind: "loading" }
  | { kind: "ready"; clips: SessionClip[] }
  | { kind: "error"; message: string };

/** Last good reading per track name, so switching views is instant. */
const clipCache = new Map<string, SessionClip[]>();

/**
 * All clips of one track's Session column.
 *
 * - One request with the MIDI script's `session_clips`. Older scripts fall
 *   back to reading the slots, all in ONE batched round trip (ableton-js
 *   bundles every command issued in the same tick into one envelope).
 * - Never overlaps reads: a slow Live can't pile requests on itself.
 * - Keeps showing the last good list while refreshing or reconnecting
 *   (this is what used to leave the view stuck on "Leyendo clips…").
 */
export function useSessionClips(client: Ableton | null, trackId: string | null, trackName: string): ClipsState {
  const [state, setState] = useState<ClipsState>(() => {
    const cached = clipCache.get(trackName);
    return cached ? { kind: "ready", clips: cached } : { kind: "loading" };
  });

  useEffect(() => {
    const cached = clipCache.get(trackName);
    setState(cached ? { kind: "ready", clips: cached } : { kind: "loading" });
  }, [trackName]);

  useEffect(() => {
    if (!client || !trackId) return;
    let cancelled = false;
    let inFlight = false;
    let lastSig = "";
    let failures = 0;

    const read = async (): Promise<SessionClip[]> => {
      try {
        const list = await client.getProp("track", trackId, "session_clips");
        if (Array.isArray(list)) return list as SessionClip[];
      } catch {
        // older MIDI script without session_clips: fall through
      }
      const slots: any[] = await client.getProp("track", trackId, "clip_slots");
      const withClip = slots.map((s, i) => ({ s, i })).filter(({ s }) => s?.has_clip);
      const clips = await Promise.all(
        withClip.map(({ s }) => client.getProp("clip_slot", String(s.id), "clip").catch(() => null)),
      );
      const out: SessionClip[] = [];
      withClip.forEach(({ s, i }, k) => {
        const c = clips[k];
        if (c) out.push({ scene: i, name: c.name ?? "", color: c.color ?? null, clip_id: String(c.id), slot_id: String(s.id) });
      });
      return out;
    };

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const list = await read();
        if (cancelled) return;
        failures = 0;
        const sig = list.map((c) => `${c.scene}:${c.name}:${c.color}:${c.slot_id}`).join("|");
        if (sig !== lastSig) {
          lastSig = sig;
          clipCache.set(trackName, list);
          setState({ kind: "ready", clips: list });
        }
      } catch (err) {
        if (cancelled) return;
        failures += 1;
        // Only surface an error if we have nothing to show.
        if (!clipCache.get(trackName) && failures >= 2) {
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

/* ------------------------------------------------------------------ */
/* Everything a view needs                                             */
/* ------------------------------------------------------------------ */

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

export function useSongStructure(client: Ableton | null) {
  useLiveConfigSync(client);
  const rawTracks = useLiveRawList<any>("song", "tracks");
  const config = useStore(songStore, (s) => s.config);
  const selectedScene = useStore(songStore, (s) => s.selectedScene);

  const trackByName = (name: string) =>
    name ? (rawTracks ?? []).find((t: any) => t.name === name) ?? null : null;
  const songTrack = trackByName(config.songTrack);
  const partsTrack = trackByName(config.partsTrack);
  const songTrackId: string | null = songTrack ? String(songTrack.id) : null;
  const partsTrackId: string | null = partsTrack ? String(partsTrack.id) : null;
  const configured = !!config.songTrack && !!config.partsTrack;
  const tracksMissing = configured && rawTracks !== null && (!songTrack || !partsTrack);

  const songsState = useSessionClips(client, songTrackId, config.songTrack);
  const partsState = useSessionClips(client, partsTrackId, config.partsTrack);
  const songs = songsState.kind === "ready" ? songsState.clips : null;
  const parts = partsState.kind === "ready" ? partsState.clips : null;

  const songPlaying = useTrackProp<number>(client, songTrackId, "playing_slot_index");
  const partPlaying = useTrackProp<number>(client, partsTrackId, "playing_slot_index");
  const partFired = useTrackProp<number>(client, partsTrackId, "fired_slot_index");

  const songForScene = (scene: number): SessionClip | null => {
    let found: SessionClip | null = null;
    for (const s of songs ?? []) if (s.scene <= scene) found = s;
    return found;
  };

  // Follow Live: a playing song clip, or the song owning the playing part.
  useEffect(() => {
    if (!config.follow || !songs) return;
    const fromSong = typeof songPlaying === "number" && songPlaying >= 0 ? songs.find((s) => s.scene === songPlaying) : null;
    const fromPart = typeof partPlaying === "number" && partPlaying >= 0 ? songForScene(partPlaying) : null;
    const target = fromSong ?? fromPart;
    if (target && target.scene !== songStore.getState().selectedScene) songStore.getState().select(target.scene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.follow, songs, songPlaying, partPlaying]);

  // Default to the first song.
  useEffect(() => {
    if (songs && songs.length > 0 && (selectedScene === null || !songs.some((s) => s.scene === selectedScene))) {
      songStore.getState().select(songs[0].scene);
    }
  }, [songs, selectedScene]);

  const song = songs?.find((s) => s.scene === selectedScene) ?? null;
  const songIndex = song && songs ? songs.indexOf(song) : -1;
  const nextSong = songs && songIndex >= 0 ? songs[songIndex + 1] ?? null : null;

  const autoParts = useMemo(() => {
    if (!song || !parts) return [];
    const end = nextSong ? nextSong.scene : Number.POSITIVE_INFINITY;
    return parts.filter((p) => p.scene >= song.scene && p.scene < end);
  }, [song, nextSong, parts]);

  const picked = song ? config.picks[song.name] : undefined;
  const songParts: SessionClip[] = useMemo(() => {
    if (!picked || !parts) return autoParts;
    const out: SessionClip[] = [];
    for (const ref of picked) {
      const exact = parts.find((p) => p.scene === ref.scene && p.name === ref.name);
      const byName = exact ?? parts.find((p) => p.name === ref.name && (!song || p.scene >= song.scene));
      if (byName) out.push(byName);
    }
    return out;
  }, [picked, parts, autoParts, song]);

  const playingIdx = songParts.findIndex((p) => p.scene === partPlaying);
  const currentPart = playingIdx >= 0 ? songParts[playingIdx] : null;
  const nextPart = playingIdx >= 0 ? songParts[playingIdx + 1] ?? null : null;
  const queuedPart = songParts.find((p) => p.scene === partFired && p.scene !== partPlaying) ?? null;

  return {
    rawTracks,
    config,
    setConfig: (c: SongConfig) => songStore.getState().setConfig(c),
    select: (scene: number | null) => songStore.getState().select(scene),
    configured,
    tracksMissing,
    songsState,
    partsState,
    songs,
    parts,
    selectedScene,
    song,
    nextSong,
    songParts,
    picked: !!picked,
    songPlaying: typeof songPlaying === "number" ? songPlaying : -1,
    partPlaying: typeof partPlaying === "number" ? partPlaying : -1,
    partFired: typeof partFired === "number" ? partFired : -1,
    currentPart,
    nextPart,
    queuedPart,
    songForScene,
  };
}
