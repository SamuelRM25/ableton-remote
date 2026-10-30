import { useSyncExternalStore } from "react";

type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
type GetState<T> = () => T;
type StoreApi<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(
  initializer: (set: SetState<T>, get: GetState<T>) => T,
): StoreApi<T> & { getState(): T } {
  let state: T;
  const listeners = new Set<() => void>();

  const set: SetState<T> = (partial) => {
    const next =
      typeof partial === "function"
        ? (partial as (s: T) => Partial<T>)(state)
        : partial;
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };
  const get: GetState<T> = () => state;

  state = initializer(set, get);

  return {
    getState: get,
    setState: set,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T, U>(store: StoreApi<T>, selector: (state: T) => U): U {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
