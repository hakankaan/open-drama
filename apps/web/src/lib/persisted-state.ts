'use client';

import { useCallback, useSyncExternalStore } from 'react';

const PREFIX = 'open-drama:';

/** The values of this tab by key, read from localStorage once; `undefined` = nothing stored. */
const cache = new Map<string, unknown>();
const listeners = new Set<() => void>();

const read = (key: string): unknown => {
  if (!cache.has(key)) {
    let value: unknown;
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      value = raw === null ? undefined : JSON.parse(raw);
    } catch {
      value = undefined;
    }
    cache.set(key, value);
  }
  return cache.get(key);
};

const notify = () => listeners.forEach((listener) => listener());

const write = (key: string, value: unknown) => {
  cache.set(key, value);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode): the preference lives for this session only.
  }
  notify();
};

// Another tab changed a preference: its cached value is read again.
const onStorage = (e: StorageEvent) => {
  if (e.key === null) cache.clear();
  else if (e.key.startsWith(PREFIX)) cache.delete(e.key.slice(PREFIX.length));
  else return;
  notify();
};

const subscribe = (listener: () => void) => {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
};

const noSubscribe = () => () => {};

/**
 * A UI preference kept in localStorage under `open-drama:<key>`, one store shared by every caller in the tab (and
 * followed across tabs). The server render and hydration use the initial value (so server and client markup match);
 * `loaded` turns true once the stored value applies.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const stored = useSyncExternalStore(subscribe, () => read(key), () => undefined);
  const loaded = useSyncExternalStore(noSubscribe, () => true, () => false);
  const value = stored === undefined ? initial : (stored as T);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key);
      write(key, typeof next === 'function' ? (next as (p: T) => T)(prev === undefined ? initial : (prev as T)) : next);
    },
    [key, initial],
  );

  return [value, update, loaded] as const;
}
