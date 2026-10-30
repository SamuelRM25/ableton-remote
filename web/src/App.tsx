import { useEffect, useState } from "react";
import { abletonStore } from "./lib/ableton-store";
import { Toasts } from "./lib/toast";
import { useViewport } from "./lib/viewport";
import { useConnectionStatus } from "./lib/hooks";
import { SideRail, type ViewId } from "./components/SideRail";
import { TopBar } from "./components/TopBar";
import { TransportBar } from "./components/TransportBar";
import { ConnectionGate } from "./components/ConnectionGate";
import { TransportView } from "./views/TransportView";
import { SessionView } from "./views/SessionView";
import { PadsView } from "./views/PadsView";
import { MixerView } from "./views/MixerView";
import { MacrosView } from "./views/MacrosView";
import { DeviceView } from "./views/DeviceView";
import { SetlistView } from "./views/SetlistView";
import { LyricsView } from "./views/LyricsView";
import { SettingsView } from "./views/SettingsView";
import { ManualView } from "./views/ManualView";

const VIEW_TITLES: Record<ViewId, string> = {
  transport: "Transport",
  session: "Session",
  pads: "Pads",
  mixer: "Mixer",
  macros: "Macros",
  device: "Device",
  setlist: "Setlist",
  lyrics: "Lyrics",
  settings: "Settings",
  manual: "Manual",
};

export function App() {
  const [view, setView] = useState<ViewId>("session");
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
          {view === "macros" && <MacrosView />}
          {view === "device" && <DeviceView />}
          {view === "setlist" && <SetlistView />}
          {view === "lyrics" && <LyricsView />}
          {view === "settings" && <SettingsView />}
          {view === "manual" && <ManualView />}
        </main>
      </div>
      <TransportBar />
      {isMobile && <SideRail active={view} onSelect={setView} mobile />}
      {!gateDismissed && <ConnectionGate onDismiss={() => setGateDismissed(true)} />}
      <Toasts />
    </div>
  );
}
