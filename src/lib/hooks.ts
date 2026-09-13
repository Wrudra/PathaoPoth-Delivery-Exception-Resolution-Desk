"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** A clock that ticks every `intervalMs`, so SLA countdowns stay honest without impure render reads. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  for (const listener of listeners.get(key) ?? []) listener();
}

/** SSR-safe localStorage-backed preference: the server snapshot is the fallback, the client reads the stored value. */
export function useStoredPreference(key: string, fallback: string): [string, (value: string) => void] {
  const subscribe = useCallback(
    (listener: () => void) => {
      const set = listeners.get(key) ?? new Set<() => void>();
      set.add(listener);
      listeners.set(key, set);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        set.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key]
  );
  const value = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) ?? fallback,
    () => fallback
  );
  const setValue = useCallback(
    (next: string) => {
      window.localStorage.setItem(key, next);
      emit(key);
    },
    [key]
  );
  return [value, setValue];
}
