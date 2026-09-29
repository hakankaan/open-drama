/**
 * An in-process concurrency limit per key: `run(key, fn)` waits, first come first served, until fewer than `limit`
 * calls of that key are running. State lives in memory; a restart fails whatever was waiting (boot cleanup).
 */
export function keyedLimiter(limit: number) {
  const running = new Map<string | number, number>();
  const waiting = new Map<string | number, (() => void)[]>();

  const release = (key: string | number) => {
    const next = waiting.get(key)?.shift();
    if (next) return next(); // the slot passes straight to the next caller
    const count = (running.get(key) ?? 1) - 1;
    if (count > 0) running.set(key, count);
    else running.delete(key);
    waiting.delete(key);
  };

  return async function run<T>(key: string | number, fn: () => Promise<T>, onWait?: () => void): Promise<T> {
    if ((running.get(key) ?? 0) < limit) running.set(key, (running.get(key) ?? 0) + 1);
    else {
      onWait?.();
      await new Promise<void>((resolve) => waiting.set(key, [...(waiting.get(key) ?? []), resolve]));
    }
    try {
      return await fn();
    } finally {
      release(key);
    }
  };
}
