/**
 * "Encadenar": when the song that is playing is in the active setlist and
 * reaches its end, jump to the start of the next song of the setlist —
 * exactly on the beat, wherever that song lives in the arrangement.
 *
 * Rendered once at app level (only while the option is on), so it works
 * whatever view is open.
 */
import { useEffect, useRef } from "react";
import type { Ableton } from "ableton-js";
import { useStore } from "./store";
import { songStore, useSongStructure } from "./song-structure";
import { toast } from "./toast";

export function SetlistChain({ client }: { client: Ableton | null }) {
  const chain = useStore(songStore, (s) => s.config.chain);
  if (!chain || !client) return null;
  return <ChainRunner client={client} />;
}

function ChainRunner({ client }: { client: Ableton }) {
  const st = useSongStructure(client);
  const timer = useRef<number | null>(null);
  const armedFor = useRef<string | null>(null);

  const playing = st.playingSong;
  const list = st.setSongs;
  const idx = playing ? list.findIndex((s) => s.key === playing.key) : -1;
  const next = idx >= 0 ? list[idx + 1] ?? null : null;
  const end = playing ? st.songEnd(playing) : Infinity;
  const quarterMs = 60000 / (st.clock.tempo || 120);
  const beatsLeft = end - st.clock.beats;

  useEffect(() => {
    const clear = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      armedFor.current = null;
    };
    if (!st.clock.isPlaying || !playing || !next || !isFinite(end)) {
      clear();
      return;
    }
    // Already flows into the next song on its own: nothing to do.
    if (Math.abs(next.pos - end) < 0.01) return;
    const id = `${playing.key}->${next.key}`;
    // Arm inside the last 2 bars (close enough for a precise timer).
    if (beatsLeft > 8 || beatsLeft <= 0) {
      // Not near the end (or you jumped away): nothing should be pending.
      if (beatsLeft > 8) clear();
      return;
    }
    if (armedFor.current === id) return;
    clear();
    armedFor.current = id;
    const target = next.pos;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      // Relative to the song's end: the phase stays exact even if the
      // command lands a few ms early or late.
      void client.song.jumpBy(target - end).catch(() => toast("No se pudo encadenar la siguiente canción"));
      songStore.getState().select(next.key);
    }, Math.max(0, beatsLeft * quarterMs - 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.clock.isPlaying, playing?.key, next?.key, Math.floor(beatsLeft)]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  return null;
}
