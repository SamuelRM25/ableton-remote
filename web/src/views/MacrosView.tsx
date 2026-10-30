import { useEffect, useState } from "react";
import { useAbleton } from "../lib/hooks";
import { useLiveChildProp } from "../lib/list-hooks";
import { Knob } from "../components/Knob";
import { DevicePicker } from "../components/DevicePicker";

export function MacrosView() {
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

  if (!client) return <Empty>Sin conexión</Empty>;

  return (
    <div className="h-full flex flex-col">
      <div
        className="h-14 shrink-0 flex items-center px-5 gap-4"
        style={{
          background: "var(--color-surface-1)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <div className="flex flex-col">
          <span
            className="label-cap"
            style={{ color: "var(--color-accent-macro)" }}
          >
            Macro knobs
          </span>
          <span
            className="truncate"
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "var(--color-text-1)",
            }}
          >
            {deviceName ?? "—"}
          </span>
        </div>
        <div className="flex-1" />
      </div>
      {client && <DevicePicker client={client} />}
      <div
        className="flex-1 overflow-auto p-4 sm:p-6"
        style={{ background: "var(--color-bg)" }}
      >
        {!device ? (
          <Empty>Elige un track y un device arriba para ver sus macros</Empty>
        ) : parameters && parameters.length > 0 ? (
          <div
            className="grid gap-5"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            }}
          >
            {parameters.slice(0, 16).map((p: any, i: number) => (
              <MacroCell key={p.raw?.id ?? i} param={p} index={i} />
            ))}
          </div>
        ) : (
          <Empty>Este device no tiene parámetros</Empty>
        )}
      </div>
    </div>
  );
}

function MacroCell({ param, index }: { param: any; index: number }) {
  const value = useLiveChildProp<number>(param, "value");
  const min = useLiveChildProp<number>(param, "min");
  const max = useLiveChildProp<number>(param, "max");
  const name = useLiveChildProp<string>(param, "name");
  const valueStr = useLiveChildProp<string>(param, "value_string");

  return (
    <div className="panel flex flex-col items-center" style={{ padding: 16 }}>
      <span className="label-cap" style={{ color: "var(--color-accent-macro)" }}>
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="mt-2">
        <Knob
          value={value ?? 0}
          min={min ?? 0}
          max={max ?? 1}
          onChange={(v) => {
            void param.set("value", v).catch(() => {});
          }}
          size={64}
          color="var(--color-accent-macro)"
        />
      </div>
      <span
        className="value-mono mt-2"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-text-1)",
        }}
      >
        {valueStr ?? formatValue(value ?? 0, min ?? 0, max ?? 1)}
      </span>
      <span
        className="truncate w-full text-center mt-1"
        style={{
          fontSize: 12,
          color: "var(--color-text-2)",
        }}
      >
        {name ?? "—"}
      </span>
    </div>
  );
}

function formatValue(v: number, min: number, max: number): string {
  if (max === min) return "—";
  const fraction = (v - min) / (max - min);
  return `${Math.round(fraction * 100)}%`;
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
