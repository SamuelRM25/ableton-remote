/**
 * Setlist: everything about the songs of the night in one place.
 *   - En vivo: the current song's parts as pads, prev/next, loop, follow, chain.
 *   - Armar:   pick and order songs, see how long the set runs.
 *   - Marcas:  Live's locators (count-in, loop to next, groups, export…).
 */
import { useState } from "react";
import type { Ableton } from "ableton-js";
import { LedKey } from "../components/hw";
import { SongView } from "./SongView";
import { SetlistBuilder } from "./SetlistBuilder";
import { SetlistView } from "./SetlistView";

type Tab = "live" | "build" | "marks";
const TAB_KEY = "ableton-remote.setlist.tab";

function loadTab(): Tab {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return t === "build" || t === "marks" ? t : "live";
  } catch {
    return "live";
  }
}

export function SetlistHub({ client }: { client: Ableton | null }) {
  const [tab, setTabState] = useState<Tab>(loadTab);
  const setTab = (t: Tab) => {
    setTabState(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      // ignore
    }
  };
  const switcher = (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="hidden sm:inline" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, letterSpacing: "0.06em", marginRight: 6 }}>
        Setlist
      </span>
      <LedKey size="sm" variant="ring" color="cue" active={tab === "live"} label="En vivo" onClick={() => setTab("live")} />
      <LedKey size="sm" variant="ring" color="cue" active={tab === "build"} label="Armar" onClick={() => setTab("build")} />
      <LedKey size="sm" variant="ring" color="cue" active={tab === "marks"} label="Marcas" onClick={() => setTab("marks")} />
    </div>
  );
  if (tab === "build") return <SetlistBuilder client={client} switcher={switcher} onConfigure={() => setTab("live")} />;
  if (tab === "marks") return <SetlistView switcher={switcher} />;
  return <SongView client={client} switcher={switcher} />;
}
