import { useEffect, useState } from "react";
import { createStore } from "./store";
import { useStore } from "./store";

export interface ToastItem {
  id: number;
  message: string;
}

interface ToastStore {
  items: ToastItem[];
  push(message: string): void;
  dismiss(id: number): void;
}

let nextId = 1;

export const toastStore = createStore<ToastStore>((set, get) => ({
  items: [],
  push(message: string) {
    const id = nextId++;
    set({ items: [...get().items.slice(-2), { id, message }] });
    window.setTimeout(() => get().dismiss(id), 2600);
  },
  dismiss(id: number) {
    set({ items: get().items.filter((t) => t.id !== id) });
  },
}));

export function toast(message: string) {
  toastStore.getState().push(message);
}

export function Toasts() {
  const items = useStore(toastStore, (s) => s.items);
  if (items.length === 0) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none"
      style={{ bottom: 120, zIndex: 200 }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="panel-raised px-4 py-2.5"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text-1)",
            borderColor: "var(--color-critical)",
            maxWidth: "min(480px, 90vw)",
            textAlign: "center",
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
