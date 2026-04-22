import { useEffect, useRef } from 'react';

/**
 * Persist a form-state object to localStorage so users don't lose
 * their input when switching browser tabs / leaving the page.
 *
 * - Loads any saved draft on mount (calls `onLoad` with the parsed value).
 * - Saves `value` whenever it changes (debounced via microtask).
 * - Provides `clear()` to wipe the draft (e.g. after a successful save).
 */
export function useDraftPersistence<T>(
  key: string | null,
  value: T,
  onLoad: (saved: T) => void,
  enabled = true,
) {
  const loadedRef = useRef(false);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  // Load on mount / when key changes
  useEffect(() => {
    if (!enabled || !key) return;
    loadedRef.current = false;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        onLoadRef.current(parsed);
      }
    } catch {
      /* ignore */
    }
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  // Save on every change after initial load
  useEffect(() => {
    if (!enabled || !key || !loadedRef.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota exceeded — silently ignore */
    }
  }, [key, value, enabled]);

  const clear = () => {
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  };

  return { clear };
}
