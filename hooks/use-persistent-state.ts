"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A view preference persisted to localStorage (per browser), e.g. a chart's
 * selected range. Uses useSyncExternalStore like the privacy toggle so the
 * server render uses the default and hydration never mismatches.
 *
 * `allowed` guards against stale or hand-edited values: anything not in the
 * list falls back to `defaultValue`.
 */
const CHANGE_EVENT = "sors-persistent-state";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function usePersistentState<T extends string | number>(
  key: string,
  defaultValue: T,
  allowed: readonly T[]
): [T, (value: T) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null // server snapshot
  );

  const parsed = raw === null ? undefined : allowed.find((v) => String(v) === raw);
  const value = parsed ?? defaultValue;

  const setValue = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, String(next));
      } catch {
        /* storage unavailable: keep working, just don't persist */
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key]
  );

  return [value, setValue];
}
