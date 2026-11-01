import { useEffect, useState } from "react";
import { useAbleton } from "../lib/hooks";
import { useLiveChildProp, useParamDisplay } from "../lib/list-hooks";
import { useOptimistic } from "../lib/hooks";
import { EmptyPanel, LedKey, ViewStrip } from "../components/hw";
import { toast } from "../lib/toast";
import { Knob } from "../components/Knob";
import { DevicePicker } from "../components/DevicePicker";

export function MacrosView({ switcher }: { switcher?: React.ReactNode } = {}) {
  const client = useAbleton();
  const [device, setDevice] = useState<any>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      try {
        const dev = await client.song.get("appointed_device");
        if (cancelled) return;
        setDevice(dev);
      } catch {
        setDevice(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, version]);

  useEffect(() => {
    if (!client) return;
    let off: (() => Promise<unknown>) | null = null;
    (async () => {
      try {
        off = await client.song.addListener("appointed_device", () => {
          setVersion((v) => v + 1);
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      if (off) void off().catch(() => {});
    };
  }, [client]);

  const deviceName = useLiveChildProp<string>(device, "name");
  const parameters = useLiveChildProp<any[]>(device, "parameters");

  if (!client) {
    return <EmptyPanel title="Live no está conectado" hint="Abre Ableton Live con DAWRemote activo como Control Surface." />;
  }

  // Parameter 0 is always "Device On"; the macros start at index 1.
  const power = parameters?.[0];
  const macros = (parameters ?? []).slice(1, 17);

  return (
    <div className="h-full flex flex-col">
      <ViewStrip>
        <div className="flex flex-col min-w-0">
          <span className="label-cap" style={{ fontSize: 10, color: "var(--color-accent-macro)" }}>Macros</span>
          <span className="truncate" style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: "0.02em" }}>
            {device ? deviceName ?? "—" : "Ningún device"}
          </span>
        </div>
        <div className="flex-1" />
        {switcher}
        {power && <PowerKey param={power} />}
      </ViewStrip>
      <DevicePicker client={client} />
      <div className="flex-1 overflow-auto scroll-touch p-3 sm:p-5">
        {!device ? (
          <EmptyPanel title="Elige un device" hint="Toca un track y luego uno de sus devices en la barra de arriba." />
        ) : macros.length > 0 ? (
          <div
            className="panel grid mx-auto"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))",
              gap: 6,
              padding: 14,
              maxWidth: 1100,
            }}
          >
            {macros.map((p: any, i: number) => (
              <MacroCell key={p.raw?.id ?? i} param={p} index={i} />
            ))}
          </div>
        ) : (
          <EmptyPanel title="Este device no tiene parámetros" />
        )}
      </div>
    </div>
  );
}

function PowerKey({ param }: { param: any }) {
  const value = useLiveChildProp<number>(param, "value");
  const on = (value ?? 0) > 0.5;
  return (
    <LedKey
      size="md"
      variant="dot"
      color="play"
      active={on}
      label={on ? "On" : "Off"}
      onClick={() => void param.set("value", on ? 0 : 1).catch(() => toast("No se pudo cambiar el device"))}
      title="Activar o desactivar el device"
    />
  );
}

function MacroCell({ param, index }: { param: any; index: number }) {
  const live = useLiveChildProp<number>(param, "value");
  const min = useLiveChildProp<number>(param, "min");
  const max = useLiveChildProp<number>(param, "max");
  const name = useLiveChildProp<string>(param, "name");
  const [value, setValue] = useOptimistic<number>(live, (v) => {
    void param.set("value", v).catch(() => {});
  });
  const display = useParamDisplay(param, live);
  const lo = min ?? 0;
  const hi = max ?? 1;

  return (
    <div
      className="flex flex-col items-center"
      style={{
        padding: "14px 8px 12px",
        borderRadius: 8,
        background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.12))",
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)",
      }}
    >
      <span
        className="truncate w-full text-center"
        style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, letterSpacing: "0.03em", color: "var(--color-text-1)" }}
        title={name}
      >
        {name ?? `Macro ${index + 1}`}
      </span>
      <div style={{ marginTop: 10 }}>
        <Knob
          value={value ?? lo}
          min={lo}
          max={hi}
          onChange={setValue}
          size={78}
          bare
          color="var(--color-accent-macro)"
          ariaLabel={name}
        />
      </div>
      <span
        className="vfd value-mono"
        style={{
          marginTop: 10,
          padding: "3px 9px",
          fontSize: 12,
          fontWeight: 700,
          color: "var(--color-vfd-ink)",
          textShadow: "0 0 5px rgba(255,178,62,0.45)",
          minWidth: 64,
          textAlign: "center",
        }}
      >
        {display ?? formatValue(value ?? lo, lo, hi)}
      </span>
    </div>
  );
}

function formatValue(v: number, min: number, max: number): string {
  if (max === min) return "—";
  return `${Math.round(((v - min) / (max - min)) * 100)}%`;
}
