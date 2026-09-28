'use client';

import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'open-drama:';

const read = <T,>(key: string): T | undefined => {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
};

/**
 * A UI preference kept in localStorage under `open-drama:<key>`. The first render uses the initial value
 * (so server and client markup match) and the stored value is applied right after mount.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = read<T>(key);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from storage after mount is the point
    if (stored !== undefined) setValue(stored);
    setLoaded(true);
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(PREFIX + key, JSON.stringify(resolved));
        } catch {
          // Storage unavailable (private mode): the preference lives for this session only.
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update, loaded] as const;
}
