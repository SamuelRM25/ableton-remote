import { useState } from "react";
import { LedKey } from "../components/hw";
import { MacrosView } from "./MacrosView";
import { DeviceView } from "./DeviceView";

type Tab = "macros" | "params";
const TAB_KEY = "ableton-remote.device.tab";

function loadTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === "params" ? "params" : "macros";
  } catch {
    return "macros";
  }
}

/** Macros and the full parameter list of the same device, one view. */
export function DeviceHub() {
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
      <LedKey size="sm" variant="ring" color="macro" active={tab === "macros"} label="Macros" onClick={() => setTab("macros")} />
      <LedKey size="sm" variant="ring" color="macro" active={tab === "params"} label="Parámetros" onClick={() => setTab("params")} />
    </div>
  );
  return tab === "macros" ? <MacrosView switcher={switcher} /> : <DeviceView switcher={switcher} />;
}
