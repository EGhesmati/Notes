import { useState, useEffect } from "react";

/**
 * Debounces a value by `delay` milliseconds.
 * Returns the debounced value which only updates after the specified delay
 * has passed since the last change to `value`.
 *
 * @example
 * const debouncedSearch = useDebounce(search, 300);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
