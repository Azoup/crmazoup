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
  const lastKeyRef = useRef<string | null>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  // Load on mount / when key changes
  useEffect(() => {
    if (!key) return;
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
    lastKeyRef.current = key;
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Save on every change after initial load
  useEffect(() => {
    const storageKey = key ?? lastKeyRef.current;
    if (!enabled || !storageKey || !loadedRef.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
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
