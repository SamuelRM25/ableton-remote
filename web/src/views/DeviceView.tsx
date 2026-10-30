import { useEffect, useState } from "react";
import { useAbleton } from "../lib/hooks";
import { useLiveChildProp, useParamDisplay } from "../lib/list-hooks";
import { useOptimistic } from "../lib/hooks";
import { EmptyPanel, LedKey, ViewStrip } from "../components/hw";
import { toast } from "../lib/toast";
import { Fader } from "../components/Fader";
import { DevicePicker } from "../components/DevicePicker";

export function DeviceView({ switcher }: { switcher?: React.ReactNode } = {}) {
  const client = useAbleton();
  const [device, setDevice] = useState<any>(null);
  const [version, setVersion] = useState(0);

  useLiveChildProp<any>(client?.song ?? null, "appointed_device");

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
      } catch {}
    })();
    return () => {
      if (off) void off().catch(() => {});
    };
  }, [client]);

  const name = useLiveChildProp<string>(device, "name");
  const className = useLiveChildProp<string>(device, "class_name");
  const type = useLiveChildProp<number>(device, "type");
  const parameters = useLiveChildProp<any[]>(device, "parameters");

  if (!client) {
    return <EmptyPanel title="Live no está conectado" hint="Abre Ableton Live con AbletonJS activo como Control Surface." />;
  }
  const hasDevice = !!device;

  return (
    <div className="h-full flex flex-col">
      <ViewStrip>
        <div className="flex flex-col min-w-0">
          <span className="label-cap" style={{ fontSize: 10 }}>Device · {className ?? "—"}</span>
          <span className="truncate" style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: "0.02em" }}>
            {hasDevice ? name ?? "—" : "Ningún device"}
          </span>
        </div>
        <div className="flex-1" />
        {switcher}
        {parameters && (
          <span className="value-mono hidden xl:inline" style={{ fontSize: 12, color: "var(--color-text-3)" }}>
            {parameters.length} parámetros
          </span>
        )}
      </ViewStrip>

      <DevicePicker client={client} />

      <div className="flex-1 min-h-0 overflow-auto scroll-touch">
        {!hasDevice ? (
          <EmptyPanel title="Elige un device" hint="Toca un track y luego uno de sus devices en la barra de arriba." />
        ) : parameters && parameters.length > 0 ? (
          <div
            className="grid gap-2 p-3 sm:p-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))" }}
          >
            {parameters.map((p, i) => (
              <ParamRow key={p.raw?.id ?? p.nsid ?? i} param={p} />
            ))}
          </div>
        ) : (
          <EmptyPanel title="Este device no tiene parámetros" />
        )}
      </div>
    </div>
  );
}

function ParamRow({ param }: { param: any }) {
  const name = useLiveChildProp<string>(param, "name");
  const live = useLiveChildProp<number>(param, "value");
  const min = useLiveChildProp<number>(param, "min");
  const max = useLiveChildProp<number>(param, "max");
  const isQuantized = useLiveChildProp<boolean>(param, "is_quantized");
  const valueItems = useLiveChildProp<string[]>(param, "value_items");
  const [value, setValue] = useOptimistic<number>(live, (v) => {
    void param.set("value", v).catch(() => toast("No se pudo cambiar el parámetro"));
  });
  const display = useParamDisplay(param, live);
  const lo = min ?? 0;
  const hi = max ?? 1;

  return (
    <div className="panel flex flex-col gap-2" style={{ padding: "10px 12px", borderRadius: 9 }}>
      <div className="flex items-center gap-2">
        <span className="truncate flex-1" style={{ fontSize: 14, fontWeight: 600 }} title={name}>
          {name ?? "—"}
        </span>
        <span
          className="vfd value-mono shrink-0"
          style={{ padding: "2px 8px", fontSize: 12, fontWeight: 700, color: "var(--color-vfd-ink)", textShadow: "0 0 5px rgba(255,178,62,0.45)", minWidth: 70, textAlign: "right" }}
        >
          {display ?? (value !== undefined ? value.toFixed(2) : "—")}
        </span>
      </div>
      {isQuantized && valueItems && valueItems.length > 0 ? (
        valueItems.length <= 6 ? (
          <div className="flex flex-wrap gap-1">
            {valueItems.map((v, i) => (
              <LedKey
                key={i}
                size="xs"
                variant="ring"
                color="macro"
                active={Math.round(value ?? 0) === i}
                label={v}
                onClick={() => setValue(i)}
                style={{ textTransform: "none", height: 26, padding: "0 8px" }}
              />
            ))}
          </div>
        ) : (
          <select
            value={Math.round(value ?? 0)}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-label={name}
            style={{ border: "1px solid rgba(0,0,0,0.6)", borderRadius: 5, padding: "6px 8px", fontSize: 13 }}
          >
            {valueItems.map((v, i) => (
              <option key={i} value={i}>
                {v}
              </option>
            ))}
          </select>
        )
      ) : (
        <Fader
          value={value ?? lo}
          min={lo}
          max={hi}
          onChange={setValue}
          width="100%"
          height={26}
          vertical={false}
          color="var(--color-accent-macro)"
          ariaLabel={name}
        />
      )}
    </div>
  );
}
