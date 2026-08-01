import { useState, useEffect, useCallback } from "react";

/**
 * Syncs state with localStorage. Reads on mount, writes on change.
 * Returns [value, setValue] just like useState, but persisted.
 */
export function useLocalStorage<T>(
  key: string,
  fallback: T,
): readonly [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  }, [key, value]);

  const setStoredValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) =>
        typeof next === "function" ? (next as (prev: T) => T)(prev) : next,
      );
    },
    [],
  );

  return [value, setStoredValue] as const;
}
