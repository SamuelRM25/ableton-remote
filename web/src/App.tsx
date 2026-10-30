import { useEffect, useState } from "react";
import { abletonStore } from "./lib/ableton-store";
import { Toasts } from "./lib/toast";
import { useViewport } from "./lib/viewport";
import { useAbleton, useConnectionStatus } from "./lib/hooks";
import { SideRail, type ViewId } from "./components/SideRail";
import { TopBar } from "./components/TopBar";
import { TransportBar } from "./components/TransportBar";
import { ConnectionGate } from "./components/ConnectionGate";
import { TransportView } from "./views/TransportView";
import { SessionView } from "./views/SessionView";
import { PadsView } from "./views/PadsView";
import { MixerView } from "./views/MixerView";
import { DeviceHub } from "./views/DeviceHub";
import { SetlistHub } from "./views/SetlistHub";
import { SetlistChain } from "./lib/setlist-chain";
import { StageView } from "./views/StageView";
import { LyricsView } from "./views/LyricsView";
import { SettingsView } from "./views/SettingsView";
import { ManualView } from "./views/ManualView";

const VIEW_TITLES: Record<ViewId, string> = {
  transport: "Transport",
  session: "Session",
  pads: "Pads",
  mixer: "Mixer",
  device: "Device",
  stage: "Escenario",
  setlist: "Setlist",
  lyrics: "Lyrics",
  settings: "Settings",
  manual: "Manual",
};

const VIEW_KEY = "ableton-remote.view";

function loadView(): ViewId {
  try {
    const v = localStorage.getItem(VIEW_KEY) as ViewId | null;
    return v && v in VIEW_TITLES ? v : "session";
  } catch {
    return "session";
  }
}

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export function App() {
  const [view, setViewState] = useState<ViewId>(loadView);
  const setView = (v: ViewId) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // ignore
    }
  };
  const client = useAbleton();
  const hash = useHash();
  const [gateDismissed, setGateDismissed] = useState(false);
  const { isMobile } = useViewport();
  const status = useConnectionStatus();

  // Once connected, a later failure should show the connection form again.
  useEffect(() => {
    if (status.kind === "connected") setGateDismissed(false);
  }, [status.kind]);

  useEffect(() => {
    void abletonStore.getState().connect();
    return () => abletonStore.getState().disconnect();
  }, []);

  // Second device on stage: http://<mac>:39031/#escenario shows only this.
  if (hash === "#escenario") {
    return (
      <div className="h-full w-full bg-bg text-text-1">
        <StageView standalone />
        <SetlistChain client={client} />
        <Toasts />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col bg-bg text-text-1">
      <TopBar view={VIEW_TITLES[view]} />
      <div className="flex-1 flex min-h-0">
        {!isMobile && <SideRail active={view} onSelect={setView} />}
        <main className="flex-1 min-w-0 overflow-hidden">
          {view === "transport" && <TransportView />}
          {view === "session" && <SessionView />}
          {view === "pads" && <PadsView />}
          {view === "mixer" && <MixerView />}
          {view === "device" && <DeviceHub />}
          {view === "stage" && <StageView />}
          {view === "setlist" && <SetlistHub client={client} />}
          {view === "lyrics" && <LyricsView />}
          {view === "settings" && <SettingsView />}
          {view === "manual" && <ManualView />}
        </main>
      </div>
      <TransportBar />
      {isMobile && <SideRail active={view} onSelect={setView} mobile />}
      {!gateDismissed && <ConnectionGate onDismiss={() => setGateDismissed(true)} />}
      <SetlistChain client={client} />
      <Toasts />
    </div>
  );
}
