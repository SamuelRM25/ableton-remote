import { useEffect, useRef, useState } from "react";
import type { Ableton } from "ableton-js";
import { useAbleton, useLiveProp } from "../lib/hooks";
import { useLiveRawList } from "../lib/list-hooks";
import { toast } from "../lib/toast";
import { jumpToTime, playFromTime, loopRange } from "../lib/cue-jump";
import { beatsToBarLabel } from "../lib/clock";
import { getBarInfo } from "../lib/bar-grid";
import {
  IconBookmark,
  IconCheck,
  IconChevronDown,
  IconLoop,
  IconMetronome,
  IconPencil,
  IconPlay,
  IconPlus,
  IconStar,
  IconStarFilled,
  IconX,
} from "../components/icons";

interface SetlistItem {
  id: string;
  name: string;
  time: number;
}

interface SongGroup {
  id: string;
  name: string;
  cueIds: string[];
}

interface SetlistState {
  items: SetlistItem[];
  songs: SongGroup[];
  customMoments: string[];
  favoriteMoments: string[];
}

/** Canonical worship song flow (used for the "next suggested" hint). */
const SONG_FLOW = [
  "Intro",
  "Verso 1",
  "Verso 2",
  "Verso 3",
  "Pre-Coro",
  "Coro",
  "Coro 2",
  "Post-Coro",
  "Puente",
  "Puente 2",
  "Interludio",
  "Instrumental",
  "Solo",
  "Subir Intensidad",
  "Bajada",
  "Espontáneo",
  "Tag",
  "Ofrenda",
  "Final",
];

const DEFAULT_FAVORITES = ["Coro", "Puente"];

const BASE_KEY = "ableton-remote.setlist.v3";
const LEGACY_KEY = "ableton-remote.setlist.v2";
/** Shared doc key inside the Live set (syncs across devices). */
const SONG_DOC_KEY = "ableton-remote:setlist";

function projectKey(filePath: string | null): string {
  if (!filePath) return `${BASE_KEY}.unsaved`;
  const base = filePath.split("/").pop() ?? filePath;
  const slug = base
    .replace(/\.als$/i, "")
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ _-]+/g, "")
    .slice(0, 60) || "unsaved";
  return `${BASE_KEY}.${slug}`;
}

function projectLabel(filePath: string | null): string {
  if (!filePath) return "Sin guardar";
  const base = filePath.split("/").pop() ?? filePath;
  return base.replace(/\.als$/i, "") || "Sin guardar";
}

function emptyState(): SetlistState {
  return { items: [], songs: [], customMoments: [], favoriteMoments: DEFAULT_FAVORITES };
}

function loadForKey(key: string): SetlistState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SetlistState>;
    if (parsed && Array.isArray(parsed.items)) {
      return {
        items: parsed.items,
        songs: Array.isArray(parsed.songs) ? parsed.songs : [],
        customMoments: Array.isArray(parsed.customMoments) ? parsed.customMoments : [],
        favoriteMoments: Array.isArray(parsed.favoriteMoments)
          ? parsed.favoriteMoments
          : DEFAULT_FAVORITES,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function adoptLegacy(): SetlistState {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as any;
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (Array.isArray(items)) {
        const moments: string[] = Array.isArray(parsed?.moments)
          ? parsed.moments.filter((m: string) => !SONG_FLOW.includes(m))
          : [];
        return {
          items: items.map((i: any) => ({
            id: String(i.liveCueId ?? i.id),
            name: String(i.name ?? "Marca"),
            time: Number(i.time ?? 0),
          })),
          songs: Array.isArray(parsed?.songs) ? parsed.songs : [],
          customMoments: moments,
          favoriteMoments: DEFAULT_FAVORITES,
        };
      }
    }
  } catch {
    // ignore
  }
  return emptyState();
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Next sequence number for a song: max leading "N - …" + 1. */
function nextSeq(items: SetlistItem[]): number {
  let max = 0;
  let count = 0;
  for (const i of items) {
    count++;
    const m = /^\s*(\d+)\s*[-–.]/.exec(i.name);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Math.max(max + 1, count + 1);
}



export function SetlistView({ switcher }: { switcher?: React.ReactNode } = {}) {
  const client = useAbleton();
  const cues = useLiveRawList<any>("song", "cue_points");
  const isPlaying = useLiveProp<boolean>(client, (c) => c.song, "is_playing");
  // Project identity: state is stored per Live set file.
  const filePath = useLiveProp<string>(client, (c) => c.song, "file_path", {
    listen: false,
    pollMs: 3000,
  });
  const key = projectKey(filePath ?? null);

  const [state, setState] = useState<SetlistState>(() => loadForKey(key) ?? adoptLegacy());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const saveTimer = useRef<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeSongId, setActiveSongId] = useState<string | null>(null);
  const [loopSongId, setLoopSongId] = useState<string | null>(null);
  // Marca desde la que corre "Loop hasta la siguiente marca" (si hay).
  const [loopCueId, setLoopCueId] = useState<string | null>(null);
  // Si alguien apaga el loop desde Live o desde la barra de transporte,
  // los indicadores del setlist se apagan también.
  const liveLoop = useLiveProp<boolean>(client, (c) => c.song, "loop");
  useEffect(() => {
    if (liveLoop === false) {
      setLoopSongId(null);
      setLoopCueId(null);
    }
  }, [liveLoop]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editSongValue, setEditSongValue] = useState("");
  const [markingSongId, setMarkingSongId] = useState<string | null>(null);
  const [addingMoment, setAddingMoment] = useState(false);
  const [newMoment, setNewMoment] = useState("");
  const [lastMoment, setLastMoment] = useState<string | null>(null);
  // Visual count-in (silent): Live does NOT count on plain playback
  // (verified: is_counting_in never fires on play — count-in is
  // record-only). We count the bar visually at tempo/signature and the
  // entry turns Live's click on so it's audible from the downbeat.
  const [countIn, setCountIn] = useState<{
    name: string;
    beatsLeft: number;
    total: number;
    tempo: number;
    signature: string;
  } | null>(null);
  const countTimers = useRef<number[]>([]);
  const lastFollowedRef = useRef<string | null>(null);
  const keyRef = useRef(key);
  keyRef.current = key;

  function save(next: SetlistState) {
    setState(next);
    try {
      localStorage.setItem(keyRef.current, JSON.stringify(next));
    } catch {
      // storage full/blocked — session-only
    }
    // Mirror to the Live set (shared across devices), debounced.
    if (countClientRef.current) {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const c = countClientRef.current;
        if (!c) return;
        void c.song
          .setData(SONG_DOC_KEY, {
            v: 3,
            items: next.items,
            songs: next.songs,
            customMoments: next.customMoments,
            favoriteMoments: next.favoriteMoments,
          })
          .catch(() => {
            // offline / too big — local copy still stands
          });
      }, 800);
    }
  }

  const countClientRef = useRef<Ableton | null>(null);
  countClientRef.current = client;

  function update(next: SetlistState) {
    save(next);
  }

  // Adopt the shared doc from the Live set on connect (all devices converge).
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      try {
        const doc = (await client.song.getData(SONG_DOC_KEY)) as any;
        if (
          !cancelled &&
          doc &&
          typeof doc === "object" &&
          Array.isArray(doc.items) &&
          Array.isArray(doc.songs)
        ) {
          const next: SetlistState = {
            items: doc.items,
            songs: doc.songs,
            customMoments: Array.isArray(doc.customMoments) ? doc.customMoments : [],
            favoriteMoments:
              Array.isArray(doc.favoriteMoments) && doc.favoriteMoments.length > 0
                ? doc.favoriteMoments
                : ["Coro", "Puente"],
          };
          setState(next);
          try {
            localStorage.setItem(keyRef.current, JSON.stringify(next));
          } catch {
            // ignore
          }
        }
      } catch {
        // no shared doc yet — local state stands
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // Switch stored state when the Live project changes.
  useEffect(() => {
    setState(loadForKey(key) ?? adoptLegacy());
    setActiveId(null);
    setActiveSongId(null);
    setLoopSongId(null);
    setMarkingSongId(null);
    lastFollowedRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Merge Live cues (raw {id,name,time}) with local items.
  // Mirror rule: the app reflects Live. Manual-only items (manual-*)
  // always survive; anything else missing from Live was deleted there
  // and is dropped (this also clears stale "ghost" marks), along with
  // its song assignments.
  // Live object ids churn on every Live restart, so items that miss by id
  // are re-linked by (time) and adopt the fresh id — song assignments
  // survive restarts.
  useEffect(() => {
    if (!cues) return;
    setState((current) => {
      const liveIds = new Set(cues.map((c: any) => String(c.id)));
      const idRemap = new Map<string, string>();
      const next: SetlistItem[] = [];
      const unmatched = current.items.filter(
        (i) => !i.id.startsWith("manual-") && !liveIds.has(i.id),
      );
      for (const cp of cues) {
        const id = String(cp.id);
        const time = Number(cp.time ?? 0);
        let existing = current.items.find((i) => i.id === id);
        if (!existing) {
          const byTime = unmatched.find((i) => Math.abs(i.time - time) < 0.02);
          if (byTime) {
            idRemap.set(byTime.id, id);
            existing = byTime;
          }
        }
        next.push({
          id,
          name: existing?.name ?? cp.name ?? "Marca",
          time,
        });
      }
      for (const i of current.items) {
        if (i.id.startsWith("manual-") && !next.find((n) => n.id === i.id)) {
          next.push(i);
        }
      }
      const remappedSongs = current.songs.map((s) => ({
        ...s,
        cueIds: s.cueIds
          .map((id) => idRemap.get(id) ?? id)
          .filter((id) => next.some((n) => n.id === id)),
      }));
      const out = {
        items: next,
        songs: remappedSongs,
        customMoments: current.customMoments,
        favoriteMoments: current.favoriteMoments,
      };
      try {
        localStorage.setItem(keyRef.current, JSON.stringify(out));
      } catch {
        // ignore
      }
      return out;
    });
  }, [cues]);

  // Follow the playhead: highlight current cue + song, autoscroll while playing.
  useEffect(() => {
    if (!client || state.items.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const now = await client.song.get("current_song_time");
        if (cancelled) return;
        let best: SetlistItem | null = null;
        for (const i of state.items) {
          if (i.time <= now + 0.05 && (!best || i.time > best.time)) best = i;
        }
        if (cancelled || !best) return;
        setActiveId(best.id);
        const song =
          state.songs.find((s) => s.cueIds.includes(best!.id)) ?? null;
        setActiveSongId(song?.id ?? null);
        if (isPlaying && lastFollowedRef.current !== best.id) {
          lastFollowedRef.current = best.id;
          document
            .getElementById(`cue-${best.id}`)
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      } catch {
        // ignore
      }
    };
    const timer = window.setInterval(tick, 1000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [client, state.items, state.songs, isPlaying]);

  // Cancel count-in on unmount.
  useEffect(
    () => () => {
      for (const t of countTimers.current) window.clearTimeout(t);
      countTimers.current = [];
    },
    [],
  );

  async function handleJump(item: SetlistItem) {
    if (!client) return;
    cancelCountIn();
    setActiveId(item.id);
    lastFollowedRef.current = item.id;
    try {
      await jumpToTime(client, item.time);
    } catch {
      toast("No se pudo saltar a la marca");
    }
  }

  async function handlePlayFrom(item: SetlistItem) {
    if (!client) return;
    cancelCountIn();
    setActiveId(item.id);
    lastFollowedRef.current = item.id;
    try {
      await playFromTime(client, item.time);
    } catch {
      toast("No se pudo reproducir desde la marca");
    }
  }

  function cancelCountIn() {
    for (const t of countTimers.current) window.clearTimeout(t);
    countTimers.current = [];
    setCountIn(null);
  }

  /**
   * Count-in entry.
   *
   * Stopped: counts one bar on screen, then jumps + plays with Live's click
   * forced on (Live has no count-in for plain playback).
   *
   * Playing: locks to the bar that is already running. If you tap on beat 3
   * of 4, it counts only the beats left (3, 4) and enters on the next
   * downbeat — never a fresh 4-beat count that would put you off the grid.
   * The jump is RELATIVE to that downbeat (jump_by(cue − downbeat)), so the
   * phase is exact even if the command reaches Live a few ms early or late.
   *
   * Units: Live's tempo is in quarter notes and its positions in quarter-note
   * beats; one signature beat is 4/den quarters (an eighth in 6/8).
   */
  async function handleCountInPlay(item: SetlistItem) {
    if (!client) return;
    cancelCountIn();
    setActiveId(item.id);
    lastFollowedRef.current = item.id;
    try {
      const asked = performance.now();
      const [tempoRaw, sigRaw, sigDenRaw, prevClick, playing, grid] = await Promise.all([
        client.song.get("tempo"),
        client.song.get("signature_numerator"),
        client.song.get("signature_denominator").catch(() => 4),
        client.song.get("metronome"),
        client.song.get("is_playing"),
        getBarInfo(client),
      ]);
      const answered = performance.now();
      const tempo = tempoRaw > 0 ? tempoRaw : 120;
      const num = sigRaw > 0 ? Math.floor(sigRaw) : 4;
      const den = sigDenRaw > 0 ? Math.floor(sigDenRaw) : 4;
      const quarterMs = 60000 / tempo;
      const beatQ = 4 / den; // one signature beat, in quarter notes
      const barQ = num * beatQ;
      const beatMs = quarterMs * beatQ;
      const ENTRY_LEAD_MS = 120;
      const show = (left: number) =>
        setCountIn({
          name: item.name,
          beatsLeft: left,
          total: num,
          tempo: Math.round(tempo * 100) / 100,
          signature: `${num}/${den}`,
        });
      const restoreClick = (afterMs: number) => {
        if (prevClick) return;
        window.setTimeout(() => {
          void client.song.set("metronome", false as any).catch(() => {});
        }, afterMs);
      };

      if (playing) {
        // Where the playhead is right now (the reply took ~half the round trip).
        const pos = grid.pos + ((answered - asked) / 2 + (performance.now() - answered)) / quarterMs;
        // Bar lines come from Live's own grid (time-signature changes
        // included), not from "every bar is N beats since bar 1".
        let nextDownbeat = grid.barStart + grid.barQ;
        while (nextDownbeat - pos < 0) nextDownbeat += grid.barQ;
        let remainingQ = nextDownbeat - pos;
        // Too close to the downbeat to react: enter on the following one.
        if (remainingQ * quarterMs < 250) {
          nextDownbeat += grid.barQ;
          remainingQ += grid.barQ;
        }
        const t0 = performance.now();
        const untilDownbeatMs = remainingQ * quarterMs;
        const beatsLeft = Math.ceil(remainingQ / beatQ - 1e-6);

        if (!prevClick) void client.song.set("metronome", true as any).catch(() => {});
        show(beatsLeft);
        // Update the big number on every beat line until the downbeat.
        const firstLineMs = (remainingQ - (beatsLeft - 1) * beatQ) * quarterMs;
        for (let k = 1; k < beatsLeft; k++) {
          const at = firstLineMs + (k - 1) * beatMs;
          countTimers.current.push(window.setTimeout(() => show(beatsLeft - k), Math.max(0, at - (performance.now() - t0))));
        }
        const fireId = window.setTimeout(() => {
          countTimers.current = [];
          setCountIn(null);
          void client.song
            .jumpBy(item.time - nextDownbeat)
            .then(async () => {
              // jump_by is unquantized and keeps playing; this is just a
              // safety net in case the transport stopped meanwhile.
              if (!(await client.song.get("is_playing"))) await client.song.continuePlaying();
              restoreClick(barQ * quarterMs);
            })
            .catch(() => toast("No se pudo entrar en la marca"));
        }, Math.max(0, untilDownbeatMs - ENTRY_LEAD_MS - (performance.now() - t0)));
        countTimers.current.push(fireId);
        return;
      }

      // Stopped: one full bar on screen, then play from the cue.
      show(num);
      for (let k = 1; k < num; k++) {
        countTimers.current.push(window.setTimeout(() => show(num - k), Math.max(0, k * beatMs)));
      }
      const fireId = window.setTimeout(() => {
        countTimers.current = [];
        setCountIn(null);
        void (async () => {
          try {
            if (!prevClick) await client.song.set("metronome", true as any);
            await playFromTime(client, item.time);
            restoreClick(barQ * quarterMs);
          } catch {
            toast("No se pudo reproducir desde la marca");
          }
        })();
      }, Math.max(0, num * beatMs - ENTRY_LEAD_MS));
      countTimers.current.push(fireId);
    } catch {
      toast("No se pudo iniciar el conteo");
      setCountIn(null);
    }
  }

  /**
   * Ensure the playhead is exactly on the cue (batched jump+check in ONE
   * envelope so a playing transport can't drift between the two).
   */
  async function ensureCueSelected(time: number): Promise<boolean> {
    if (!client) return false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const now = await client.song.get("current_song_time");
      const delta = time - now;
      if (Math.abs(delta) > 0.005) {
        const pj = client.song.jumpBy(delta);
        const ps = client.song.isCuePointSelected();
        const [, sel] = await Promise.all([pj, ps]);
        if (sel) return true;
      } else {
        try {
          if (await client.song.isCuePointSelected()) return true;
        } catch {
          // retry below
        }
      }
    }
    return false;
  }



  function localDelete(id: string) {
    update({
      items: state.items.filter((i) => i.id !== id),
      songs: state.songs.map((s) => ({
        ...s,
        cueIds: s.cueIds.filter((c) => c !== id),
      })),
      customMoments: state.customMoments,
      favoriteMoments: state.favoriteMoments,
    });
    if (activeId === id) setActiveId(null);
  }

  // Two-step delete while playing: first tap arms (we would have to stop
  // the transport to select the cue), second tap executes.
  const [armingDeleteId, setArmingDeleteId] = useState<string | null>(null);
  const armDeleteTimer = useRef<number | null>(null);

  /** Delete the cue in Live too (manual items are local-only). */
  async function handleDelete(item: SetlistItem) {
    if (!client || item.id.startsWith("manual-")) {
      localDelete(item.id);
      return;
    }
    let playing = false;
    try {
      playing = await client.song.get("is_playing");
    } catch {
      // assume stopped
    }
    if (playing && armingDeleteId !== item.id) {
      setArmingDeleteId(item.id);
      if (armDeleteTimer.current !== null) window.clearTimeout(armDeleteTimer.current);
      armDeleteTimer.current = window.setTimeout(() => setArmingDeleteId(null), 4000);
      toast("Sonando: se pausará para borrar — toca de nuevo");
      return;
    }
    if (armDeleteTimer.current !== null) window.clearTimeout(armDeleteTimer.current);
    setArmingDeleteId(null);
    try {
      if (playing) {
        try {
          await client.song.stopPlaying();
        } catch {
          // ignore
        }
      }
      const selected = await ensureCueSelected(item.time);
      if (!selected) {
        toast("No se pudo seleccionar la marca en Live");
        return;
      }
      await client.song.setOrDeleteCue();
      const fresh = (await client.getProp("song", undefined, "cue_points")) as any[];
      if (Array.isArray(fresh) && fresh.some((c) => String(c.id) === item.id)) {
        toast("Live no la borró");
        return;
      }
      localDelete(item.id);
      toast("Marca borrada de Live");
    } catch {
      toast("No se pudo borrar en Live");
    }
  }

  /** Rename the local label (Live cues are read-only server-side). */
  async function saveRename(item: SetlistItem, name: string) {
    const nextName = name.trim() || item.name;
    update({
      items: state.items.map((i) =>
        i.id === item.id ? { ...i, name: nextName } : i,
      ),
      songs: state.songs,
      customMoments: state.customMoments,
      favoriteMoments: state.favoriteMoments,
    });
    setEditingId(null);
  }

  function handleAddSong() {
    const song: SongGroup = {
      id: `song-${Date.now()}`,
      name: `Canción ${state.songs.length + 1}`,
      cueIds: [],
    };
    update({
      items: state.items,
      songs: [...state.songs, song],
      customMoments: state.customMoments,
      favoriteMoments: state.favoriteMoments,
    });
    setEditingSongId(song.id);
    setEditSongValue(song.name);
  }

  function handleDeleteSong(id: string) {
    if (loopSongId === id && client) {
      void client.song.set("loop", false).catch(() => {});
      setLoopSongId(null);
    }
    update({
      items: state.items,
      songs: state.songs.filter((s) => s.id !== id),
      customMoments: state.customMoments,
      favoriteMoments: state.favoriteMoments,
    });
  }

  function handleAssign(itemId: string, songId: string) {
    const songs = state.songs.map((s) => ({
      ...s,
      cueIds: s.id === songId
        ? [...new Set([...s.cueIds, itemId])]
        : s.cueIds.filter((c) => c !== itemId),
    }));
    update({ items: state.items, songs, customMoments: state.customMoments, favoriteMoments: state.favoriteMoments });
  }

  function handleAddManual() {
    const item: SetlistItem = {
      id: `manual-${Date.now()}`,
      name: `Marca ${state.items.length + 1}`,
      time: 0,
    };
    update({
      items: [...state.items, item],
      songs: state.songs,
      customMoments: state.customMoments,
      favoriteMoments: state.favoriteMoments,
    });
    setEditingId(item.id);
    setEditValue(item.name);
  }

  async function handleMarkHere() {
    if (!client) return;
    try {
      const selected = await client.song.isCuePointSelected();
      if (selected) {
        toast("Ya hay una marca justo aquí");
        return;
      }
      await client.song.setOrDeleteCue();
    } catch {
      toast("No se pudo marcar");
    }
  }

  function toggleFavorite(moment: string) {
    const fav = state.favoriteMoments.includes(moment)
      ? state.favoriteMoments.filter((m) => m !== moment)
      : [...state.favoriteMoments, moment];
    update({ items: state.items, songs: state.songs, customMoments: state.customMoments, favoriteMoments: fav });
  }

  /**
   * Quick-mark: create a Live cue at the playhead, auto-name it
   * "{seq} - {Moment}" (chronological within the song) and assign it.
   */
  async function quickMark(songId: string, moment: string) {
    if (!client) return;
    setMarkingSongId(null);
    setLastMoment(moment);
    try {
      const selected = await client.song.isCuePointSelected();
      if (selected) {
        toast("Ya hay una marca justo aquí");
        return;
      }
      const now = await client.song.get("current_song_time");
      const beforeList = (await client.getProp("song", undefined, "cue_points")) as any[];
      const beforeIds = new Set(beforeList.map((c) => String(c.id)));
      await client.song.setOrDeleteCue();
      await sleep(400);
      const afterList = (await client.getProp("song", undefined, "cue_points")) as any[];
      // Safety: if the count went DOWN, we deleted a real cue instead of
      // creating (race with the playhead). We do NOT auto-undo: undoing
      // via API proved unstable, so we report and let you undo in Live.
      if (afterList.length < beforeList.length) {
        toast("Ojo: se borró una marca existente — deshaz con ⌘Z en Live si fue un error");
        return;
      }
      let created: any =
        afterList.find(
          (c) => !beforeIds.has(String(c.id)) && Math.abs(Number(c.time) - now) < 1.5,
        ) ?? null;
      if (!created) {
        for (let i = 0; i < 4 && !created; i++) {
          await sleep(300);
          try {
            const fresh = (await client.getProp("song", undefined, "cue_points")) as any[];
            created =
              fresh.find(
                (c) => !beforeIds.has(String(c.id)) && Math.abs(Number(c.time) - now) < 1.5,
              ) ?? null;
          } catch {
            // retry
          }
        }
      }
      if (!created) {
        toast("Marca creada en Live — aparecerá sola");
        return;
      }
      const song = state.songs.find((s) => s.id === songId);
      const songItems = song
        ? state.items.filter((x) => song.cueIds.includes(x.id))
        : [];
      const name = `${nextSeq(songItems)} - ${moment}`;
      const item: SetlistItem = {
        id: String(created.id),
        name,
        time: Number(created.time ?? now),
      };
      const items = [...state.items.filter((x) => x.id !== item.id), item];
      const songs = state.songs.map((s) =>
        s.id === songId ? { ...s, cueIds: [...new Set([...s.cueIds, item.id])] } : s,
      );
      update({ items, songs, customMoments: state.customMoments, favoriteMoments: state.favoriteMoments });
      setActiveId(item.id);
      toast(`${name} → ${song?.name ?? ""}`);
    } catch {
      toast("No se pudo crear la marca");
    }
  }

  async function toggleLoopSong(songId: string) {
    if (!client) return;
    if (loopSongId === songId) {
      try {
        await client.song.set("loop", false);
      } catch {
        toast("No se pudo quitar el loop");
      }
      setLoopSongId(null);
      return;
    }
    const song = state.songs.find((s) => s.id === songId);
    if (!song) return;
    const times = song.cueIds
      .map((id) => state.items.find((i) => i.id === id)?.time)
      .filter((t): t is number => typeof t === "number");
    if (times.length === 0) {
      toast("La canción no tiene marcas");
      return;
    }
    // Beats. The loop ends where the next song (or next cue) starts;
    // for the last song, four bars after its last cue.
    const start = Math.min(...times);
    const last = Math.max(...times);
    const after = state.items
      .map((i) => i.time)
      .filter((t) => t > last + 0.01)
      .sort((a, b) => a - b)[0];
    const end = after ?? last + 16;
    try {
      await loopRange(client, start, end);
      setLoopSongId(songId);
      setLoopCueId(null);
      toast(`Loop: ${song.name}`);
    } catch {
      toast("No se pudo activar el loop");
    }
  }

  /**
   * Igual que "Loop hasta el siguiente localizador" del menú de Live:
   * pone el loop del arreglo desde esta marca hasta la siguiente y lo
   * activa. Tocar otra vez en la misma marca quita el loop.
   */
  async function toggleLoopToNext(item: SetlistItem) {
    if (!client) return;
    if (loopCueId === item.id) {
      try {
        await client.song.set("loop", false);
      } catch {
        toast("No se pudo quitar el loop");
      }
      setLoopCueId(null);
      return;
    }
    const next = state.items
      .filter((i) => i.time > item.time + 0.001)
      .sort((a, b) => a.time - b.time)[0];
    if (!next) {
      // Live tampoco ofrece la opción en la última marca.
      toast("Es la última marca: no hay una siguiente hasta donde hacer loop");
      return;
    }
    try {
      await loopRange(client, item.time, next.time);
      setLoopCueId(item.id);
      setLoopSongId(null);
      toast(`Loop: ${item.name} → ${next.name}`);
    } catch {
      toast("No se pudo activar el loop");
    }
  }

  function exportSetlist() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `setlist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importSetlist(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as Partial<SetlistState>;
        if (parsed && Array.isArray(parsed.items)) {
          update({
            items: parsed.items,
            songs: Array.isArray(parsed.songs) ? parsed.songs : [],
            customMoments: Array.isArray(parsed.customMoments) ? parsed.customMoments : [],
            favoriteMoments:
              Array.isArray(parsed.favoriteMoments) && parsed.favoriteMoments.length > 0
                ? parsed.favoriteMoments
                : DEFAULT_FAVORITES,
          });
        }
      } catch {
        toast("Archivo inválido");
      }
    };
    reader.readAsText(file);
  }

  if (!client) return <Empty>Sin conexión</Empty>;

  const allMoments = [...SONG_FLOW, ...state.customMoments.filter((m) => !SONG_FLOW.includes(m))];
  const favMoments = state.favoriteMoments.filter((m) => allMoments.includes(m));
  const flowIdx = lastMoment ? SONG_FLOW.indexOf(lastMoment) : -1;
  const suggested = flowIdx >= 0 && flowIdx + 1 < SONG_FLOW.length ? SONG_FLOW[flowIdx + 1] : null;

  const ungrouped = state.items
    .filter((i) => !state.songs.some((s) => s.cueIds.includes(i.id)))
    .sort((a, b) => a.time - b.time);

  const cueRowProps = (item: SetlistItem, index: number) => ({
    item,
    index,
    songs: state.songs,
    isActive: activeId === item.id,
    editing: editingId === item.id,
    editValue,
    onEditValue: setEditValue,
    onJump: () => void handleJump(item),
    onPlayFrom: () => void handlePlayFrom(item),
    onCountIn: () => void handleCountInPlay(item),
    isLooping: loopCueId === item.id,
    onLoopToNext: () => void toggleLoopToNext(item),
    onStartRename: () => {
      setEditingId(item.id);
      setEditValue(item.name);
    },
    onSaveRename: () => void saveRename(item, editValue),
    onCancelRename: () => setEditingId(null),
    onDelete: () => void handleDelete(item),
    deleteArmed: armingDeleteId === item.id,
    onAssign: (songId: string) => handleAssign(item.id, songId),
  });

  return (
    <div className="h-full flex flex-col">
      <div
        className="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 flex-wrap"
        style={{
          background: "var(--color-surface-1)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {switcher}
        <span
          className="value-mono truncate hidden lg:inline"
          style={{ fontSize: 12, color: "var(--color-text-1)", maxWidth: 220 }}
        >
          {projectLabel(filePath ?? null)}
        </span>
        <span className="value-mono" style={{ fontSize: 12, color: "var(--color-text-3)" }}>
          {state.items.length} marcas · {state.songs.length} canciones
        </span>
        <div className="flex-1" />
        <ToolBtn primary onClick={handleMarkHere} icon={<IconBookmark size={14} />}>
          Marcar aquí
        </ToolBtn>
        <ToolBtn onClick={handleAddSong}>+ Grupo</ToolBtn>
        <ToolBtn onClick={handleAddManual}>+ Manual</ToolBtn>
        <ToolBtn onClick={exportSetlist}>Export</ToolBtn>
        <label className="tactile" style={{ ...toolBtnStyle, cursor: "pointer" }}>
          Import
          <input
            type="file"
            accept="application/json"
            onChange={importSetlist}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <div className="flex-1 min-h-0 overflow-auto scroll-touch" style={{ background: "var(--color-bg)" }}>
        <div className="max-w-3xl mx-auto" style={{ padding: "16px 16px 32px" }}>
          {state.items.length === 0 ? (
            <Empty>No hay marcas. Toca "Mark here" con Live corriendo.</Empty>
          ) : (
            <div className="flex flex-col gap-4">
              {state.songs.map((song) => (
                <SongSection
                  key={song.id}
                  song={song}
                  items={state.items.filter((i) => song.cueIds.includes(i.id))}
                  isActive={activeSongId === song.id}
                  isLooping={loopSongId === song.id}
                  marking={markingSongId === song.id}
                  collapsed={!!collapsed[song.id]}
                  onToggleCollapse={() =>
                    setCollapsed((c) => ({ ...c, [song.id]: !c[song.id] }))
                  }
                  moments={allMoments}
                  favMoments={favMoments}
                  suggested={suggested}
                  editingName={editingSongId === song.id}
                  editValue={editSongValue}
                  onEditValue={setEditSongValue}
                  onStartRename={() => {
                    setEditingSongId(song.id);
                    setEditSongValue(song.name);
                  }}
                  onSaveRename={() => {
                    update({
                      items: state.items,
                      songs: state.songs.map((s) =>
                        s.id === song.id ? { ...s, name: editSongValue || s.name } : s,
                      ),
                      customMoments: state.customMoments,
                      favoriteMoments: state.favoriteMoments,
                    });
                    setEditingSongId(null);
                  }}
                  onCancelRename={() => setEditingSongId(null)}
                  onDelete={() => handleDeleteSong(song.id)}
                  onJumpFirst={() => {
                    const first = state.items
                      .filter((i) => song.cueIds.includes(i.id))
                      .sort((a, b) => a.time - b.time)[0];
                    if (first) void handleJump(first);
                  }}
                  onToggleLoop={() => void toggleLoopSong(song.id)}
                  onToggleMark={() =>
                    setMarkingSongId(markingSongId === song.id ? null : song.id)
                  }
                  onPickMoment={(moment) => void quickMark(song.id, moment)}
                  onToggleFavorite={(moment) => toggleFavorite(moment)}
                  onAddMoment={(moment) => {
                    const m = moment.trim();
                    if (!m || allMoments.includes(m)) return;
                    update({
                      items: state.items,
                      songs: state.songs,
                      customMoments: [...state.customMoments, m],
                      favoriteMoments: state.favoriteMoments,
                    });
                  }}
                  renderCue={(item, idx) => <CueRow key={item.id} {...cueRowProps(item, idx)} />}
                />
              ))}

              {ungrouped.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="label-cap" style={{ color: "var(--color-text-3)" }}>
                    Sin agrupar
                  </span>
                  {ungrouped.map((item, i) => (
                    <CueRow key={item.id} {...cueRowProps(item, i)} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {countIn && (
        <CountInOverlay
          name={countIn.name}
          beatsLeft={countIn.beatsLeft}
          total={countIn.total}
          tempo={countIn.tempo}
          signature={countIn.signature}
          onCancel={cancelCountIn}
        />
      )}
    </div>
  );
}

/**
 * Silent visual count-in (one bar at the live tempo/signature).
 * Live has no count-in for plain playback, so we count on screen and
 * the entry turns Live's click on — audible from the downbeat.
 */
function CountInOverlay({
  name,
  beatsLeft,
  total,
  tempo,
  signature,
  onCancel,
}: {
  name: string;
  beatsLeft: number;
  total: number;
  tempo: number;
  signature: string;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: "color-mix(in srgb, var(--color-bg) 82%, transparent)",
        backdropFilter: "blur(6px)",
        zIndex: 150,
      }}
      onClick={onCancel}
    >
      <div className="flex flex-col items-center gap-4" style={{ padding: 24 }}>
        <span className="label-cap" style={{ color: "var(--color-accent-cue)" }}>
          Entrando en
        </span>
        <span
          className="truncate"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "var(--color-text-1)",
            maxWidth: "80vw",
          }}
        >
          {name}
        </span>
        <span
          className="value-mono"
          style={{
            fontSize: "clamp(80px, 20vw, 140px)",
            fontWeight: 700,
            lineHeight: 1,
            color: "var(--color-accent-cue)",
          }}
        >
          {beatsLeft}
        </span>
        <div className="flex items-center gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className="rounded-full"
              style={{
                width: 10,
                height: 10,
                background:
                  i < total - beatsLeft
                    ? "var(--color-accent-cue)"
                    : "var(--color-surface-4)",
              }}
            />
          ))}
        </div>
        <span
          className="value-mono"
          style={{ fontSize: 13, color: "var(--color-text-2)" }}
        >
          ♩={tempo} · {signature}
        </span>
        <span className="label-cap" style={{ color: "var(--color-text-3)" }}>
          Toca para cancelar
        </span>
      </div>
    </div>
  );
}

function SongSection({
  song,
  items,
  isActive,
  isLooping,
  marking,
  collapsed,
  onToggleCollapse,
  moments,
  favMoments,
  suggested,
  editingName,
  editValue,
  onEditValue,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
  onJumpFirst,
  onToggleLoop,
  onToggleMark,
  onPickMoment,
  onToggleFavorite,
  onAddMoment,
  renderCue,
}: {
  song: SongGroup;
  items: SetlistItem[];
  isActive: boolean;
  isLooping: boolean;
  marking: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  moments: string[];
  favMoments: string[];
  suggested: string | null;
  editingName: boolean;
  editValue: string;
  onEditValue: (v: string) => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onJumpFirst: () => void;
  onToggleLoop: () => void;
  onToggleMark: () => void;
  onPickMoment: (moment: string) => void;
  onToggleFavorite: (moment: string) => void;
  onAddMoment: (moment: string) => void;
  renderCue: (item: SetlistItem, idx: number) => React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const sorted = [...items].sort((a, b) => a.time - b.time);
  return (
    <section
      className="panel"
      style={{
        padding: 12,
        borderColor: isLooping
          ? "var(--color-accent-cue)"
          : isActive
            ? "var(--color-accent-play)"
            : undefined,
      }}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: isLooping
              ? "var(--color-accent-cue)"
              : isActive
                ? "var(--color-accent-play)"
                : "var(--color-text-3)",
          }}
        />
        {editingName ? (
          <input
            value={editValue}
            onChange={(e) => onEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveRename();
              if (e.key === "Escape") onCancelRename();
            }}
            autoFocus
            style={{
              flex: 1,
              minWidth: 120,
              background: "var(--color-surface-2)",
              color: "var(--color-text-1)",
              fontSize: 16,
              fontWeight: 700,
              border: "1px solid var(--color-accent-cue)",
              borderRadius: 6,
              padding: "4px 10px",
              outline: "none",
            }}
          />
        ) : (
          <button
            onClick={onJumpFirst}
            onDoubleClick={onStartRename}
            className="text-left"
            style={{
              flex: 1,
              minWidth: 120,
              fontSize: 17,
              fontWeight: 700,
              color: "var(--color-text-1)",
              letterSpacing: "-0.01em",
            }}
          >
            {song.name}
          </button>
        )}
        <span className="value-mono" style={{ fontSize: 11, color: "var(--color-text-3)" }}>
          {items.length} {items.length === 1 ? "marca" : "marcas"}
        </span>
        {editingName ? (
          <>
            <IconBtn onClick={onSaveRename} color="var(--color-accent-play)">
              <IconCheck size={15} />
            </IconBtn>
            <IconBtn onClick={onCancelRename} color="var(--color-text-2)">
              <IconX size={15} />
            </IconBtn>
          </>
        ) : (
          <>
            <IconBtn onClick={onToggleCollapse} color="var(--color-text-2)" label={collapsed ? "Expandir" : "Retraer"}>
              <span
                style={{
                  display: "inline-block",
                  transform: collapsed ? "rotate(-90deg)" : "none",
                  transition: "transform 150ms var(--ease-instrument)",
                }}
              >
                <IconChevronDown size={15} />
              </span>
            </IconBtn>
            <IconBtn onClick={onStartRename} color="var(--color-text-2)" label="Renombrar canción">
              <IconPencil size={15} />
            </IconBtn>
            <IconBtn
              onClick={onToggleMark}
              color={marking ? "var(--color-accent-cue)" : "var(--color-accent-play)"}
              label="Agregar marca a esta canción"
            >
              <IconPlus size={15} />
            </IconBtn>
            <IconBtn
              onClick={onToggleLoop}
              color={isLooping ? "var(--color-accent-cue)" : "var(--color-text-2)"}
              label={isLooping ? "Quitar loop" : "Loop canción"}
            >
              <IconLoop size={15} />
            </IconBtn>
            <IconBtn onClick={onJumpFirst} color="var(--color-accent-play)" label="Ir al inicio">
              <IconPlay size={15} />
            </IconBtn>
            <IconBtn onClick={onDelete} color="var(--color-critical)" label="Borrar canción">
              <IconX size={15} />
            </IconBtn>
          </>
        )}
      </div>

      {marking && !editingName && (
        <div className="mt-2">
          <div className="label-cap" style={{ marginBottom: 6 }}>
            Marcar aquí como…
          </div>
          {favMoments.length > 0 && (
            <>
              <div
                className="label-cap"
                style={{ marginBottom: 4, color: "var(--color-accent-cue)", fontSize: 10 }}
              >
                ★ Favoritas
              </div>
              <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 8 }}>
                {favMoments.map((m) => (
                  <MomentChip
                    key={m}
                    label={m}
                    suggested={suggested === m}
                    onPick={() => onPickMoment(m)}
                  />
                ))}
              </div>
            </>
          )}
          <div
            className="label-cap"
            style={{ marginBottom: 4, fontSize: 10 }}
          >
            Todas las partes
          </div>
          <div className="flex flex-wrap gap-1.5">
            {moments.map((m) => (
              <MomentChip
                key={m}
                label={m}
                suggested={suggested === m}
                favorite={favMoments.includes(m)}
                onPick={() => onPickMoment(m)}
                onToggleFavorite={() => onToggleFavorite(m)}
              />
            ))}
            {adding ? (
              <span className="flex items-center gap-1.5">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                      onAddMoment(draft.trim());
                      setDraft("");
                      setAdding(false);
                    }
                    if (e.key === "Escape") {
                      setDraft("");
                      setAdding(false);
                    }
                  }}
                  autoFocus
                  placeholder="Nuevo momento…"
                  style={{
                    height: 34,
                    width: 140,
                    background: "var(--color-surface-2)",
                    color: "var(--color-text-1)",
                    fontSize: 12,
                    border: "1px solid var(--color-accent-cue)",
                    borderRadius: 8,
                    padding: "0 10px",
                    outline: "none",
                  }}
                />
                <IconBtn
                  onClick={() => {
                    if (draft.trim()) onAddMoment(draft.trim());
                    setDraft("");
                    setAdding(false);
                  }}
                  color="var(--color-accent-play)"
                >
                  <IconCheck size={15} />
                </IconBtn>
              </span>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="tactile"
                style={{
                  height: 34,
                  padding: "0 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-text-2)",
                  background: "transparent",
                  border: "1px dashed var(--color-border-strong)",
                  borderRadius: 8,
                }}
              >
                + Nuevo
              </button>
            )}
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="flex flex-col gap-2 mt-2">
          {sorted.map((item, i) => renderCue(item, i))}
        </div>
      )}
    </section>
  );
}

function MomentChip({
  label,
  suggested,
  favorite,
  onPick,
  onToggleFavorite,
}: {
  label: string;
  suggested?: boolean;
  favorite?: boolean;
  onPick: () => void;
  onToggleFavorite?: () => void;
}) {
  return (
    <span
      className="tactile"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 34,
        paddingLeft: 12,
        paddingRight: onToggleFavorite ? 4 : 12,
        gap: 6,
        background: suggested
          ? "color-mix(in srgb, var(--color-accent-cue) 22%, var(--color-surface-2))"
          : "var(--color-surface-2)",
        border: `1.5px solid ${suggested ? "var(--color-accent-cue)" : "var(--color-border)"}`,
        borderRadius: 8,
      }}
    >
      <button
        onClick={onPick}
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: suggested ? "var(--color-accent-cue)" : "var(--color-text-1)",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {label}
        {suggested && (
          <span
            className="label-cap"
            style={{ fontSize: 9, color: "var(--color-accent-cue)" }}
          >
            siguiente
          </span>
        )}
      </button>
      {onToggleFavorite && (
        <button
          onClick={onToggleFavorite}
          aria-label={favorite ? "Quitar de favoritas" : "Marcar favorita"}
          style={{
            width: 26,
            height: 26,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: favorite ? "var(--color-accent-cue)" : "var(--color-text-3)",
          }}
        >
          {favorite ? <IconStarFilled size={14} /> : <IconStar size={14} />}
        </button>
      )}
    </span>
  );
}

function CueRow({
  item,
  index,
  songs,
  isActive,
  editing,
  editValue,
  onEditValue,
  onJump,
  onPlayFrom,
  onCountIn,
  isLooping,
  onLoopToNext,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
  deleteArmed,
  onAssign,
}: {
  item: SetlistItem;
  index: number;
  songs: SongGroup[];
  isActive: boolean;
  editing: boolean;
  editValue: string;
  onEditValue: (v: string) => void;
  onJump: () => void;
  onPlayFrom: () => void;
  onCountIn: () => void;
  isLooping: boolean;
  onLoopToNext: () => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  deleteArmed: boolean;
  onAssign: (songId: string) => void;
}) {
  const currentSong = songs.find((s) => s.cueIds.includes(item.id));
  return (
    <div
      id={`cue-${item.id}`}
      className="flex items-center gap-1.5 sm:gap-2"
      style={{
        background: isActive
          ? "color-mix(in srgb, var(--color-accent-cue) 16%, var(--color-surface-1))"
          : "var(--color-surface-1)",
        border: `1px solid ${isActive ? "var(--color-accent-cue)" : "var(--color-border)"}`,
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <span
        className="value-mono shrink-0"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: isActive ? "var(--color-accent-cue)" : "var(--color-text-3)",
          width: 26,
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      {editing ? (
        <input
          value={editValue}
          onChange={(e) => onEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSaveRename();
            if (e.key === "Escape") onCancelRename();
          }}
          autoFocus
          style={{
            flex: 1,
            minWidth: 80,
            background: "var(--color-surface-2)",
            color: "var(--color-text-1)",
            fontSize: 15,
            fontWeight: 600,
            border: "1px solid var(--color-accent-cue)",
            borderRadius: 6,
            padding: "5px 10px",
            outline: "none",
          }}
        />
      ) : (
        <button
          onClick={onJump}
          onDoubleClick={onStartRename}
          className="flex-1 min-w-0 text-left"
          style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-1)" }}
        >
          <span className="truncate block">{item.name}</span>
        </button>
      )}
      <span
        className="value-mono shrink-0 hidden sm:inline"
        style={{ fontSize: 11, color: "var(--color-text-3)" }}
      >
        {beatsToBarLabel(item.time)}
      </span>
      {songs.length > 0 && !editing && (
        <select
          value={currentSong?.id ?? ""}
          onChange={(e) => e.target.value && onAssign(e.target.value)}
          className="hidden sm:block"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-2)",
            border: "1px solid var(--color-border)",
            borderRadius: 6,
            padding: "5px 6px",
            fontSize: 11,
            maxWidth: 110,
          }}
        >
          <option value="">Canción…</option>
          {songs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      {editing ? (
        <>
          <IconBtn onClick={onSaveRename} color="var(--color-accent-play)">
            <IconCheck size={15} />
          </IconBtn>
          <IconBtn onClick={onCancelRename} color="var(--color-text-2)">
            <IconX size={15} />
          </IconBtn>
        </>
      ) : (
        <>
          <IconBtn onClick={onPlayFrom} color="var(--color-accent-play)" label="Reproducir en este instante">
            <IconPlay size={15} />
          </IconBtn>
          <IconBtn onClick={onStartRename} color="var(--color-text-3)" label="Renombrar">
            <IconPencil size={14} />
          </IconBtn>
          <IconBtn onClick={onCountIn} color="var(--color-accent-cue)" label="Entrar con conteo">
            <IconMetronome size={15} />
          </IconBtn>
          <IconBtn
            onClick={onLoopToNext}
            color={isLooping ? "var(--color-accent-cue)" : "var(--color-text-2)"}
            active={isLooping}
            label={isLooping ? "Quitar loop" : "Loop hasta la siguiente marca"}
          >
            <IconLoop size={15} />
          </IconBtn>
          <IconBtn
            onClick={onDelete}
            color={deleteArmed ? "var(--color-text-inverse)" : "var(--color-critical)"}
            label={deleteArmed ? "Toca de nuevo: se pausará y borrará" : "Borrar marca (también en Live)"}
          >
            <span
              style={{
                background: deleteArmed ? "var(--color-critical)" : undefined,
                borderRadius: 6,
                padding: 4,
                display: "flex",
              }}
            >
              <IconX size={15} />
            </span>
          </IconBtn>
        </>
      )}
    </div>
  );
}

const toolBtnStyle: React.CSSProperties = {
  height: 34,
  padding: "0 12px",
  background: "var(--color-surface-2)",
  color: "var(--color-text-1)",
  fontWeight: 600,
  fontSize: 12,
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

function ToolBtn({
  children,
  onClick,
  primary,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="tactile"
      style={{
        ...toolBtnStyle,
        ...(primary
          ? {
              background: "var(--color-accent-cue)",
              color: "var(--color-text-inverse)",
              border: "none",
            }
          : {}),
      }}
    >
      {icon}
      {children}
    </button>
  );
}

function IconBtn({
  onClick,
  children,
  color,
  label,
  active,
}: {
  onClick: () => void;
  children: React.ReactNode;
  color: string;
  label?: string;
  /** Lit LED ring (e.g. a running loop). */
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className="tactile shrink-0"
      style={{
        ...(active
          ? {
              boxShadow: `inset 0 0 0 1.5px ${color}, 0 0 12px color-mix(in srgb, ${color} 40%, transparent)`,
              filter: `drop-shadow(0 0 3px ${color})`,
            }
          : {}),
        width: 32,
        height: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        background: "var(--color-surface-2)",
        border: "1px solid var(--color-border)",
        borderRadius: 8,
      }}
    >
      {children}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="label-cap" style={{ color: "var(--color-text-3)" }}>
        {children}
      </span>
    </div>
  );
}
