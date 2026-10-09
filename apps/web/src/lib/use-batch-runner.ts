'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from './api';
import { useToastError } from './errors';

/**
 * A client-side batch (Plan 3 §4.5, UI rules): one request per item, at most `concurrency` in flight, each item
 * tracked by its polled list; a 409 means that item is already generating and is not retried. `send` skips the
 * per-request refresh and `onDone` refreshes once at the end. `namespace` holds the `progress` and `summary` messages.
 */
export function useBatchRunner<T>({
  namespace,
  concurrency,
  send,
  onDone,
}: {
  namespace: string;
  concurrency: number;
  send: (item: T) => Promise<unknown>;
  onDone: () => void;
}) {
  const t = useTranslations(namespace);
  const toastError = useToastError();
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);
  // Leaving the page stops queuing new requests; the ones already sent keep running on the server.
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const run = useCallback(
    async (items: T[]) => {
      if (items.length === 0) return;
      setRunning(true);
      const id = toast.loading(t('progress', { done: 0, total: items.length }));
      const counts = { started: 0, already: 0, failed: 0 };
      let done = 0;
      const queue = [...items];
      const worker = async () => {
        for (let item = queue.shift(); item !== undefined && !cancelled.current; item = queue.shift()) {
          try {
            await send(item);
            counts.started++;
          } catch (err) {
            if (err instanceof ApiError && err.code === 'CONFLICT') counts.already++;
            else {
              counts.failed++;
              if (counts.failed === 1) toastError(err);
            }
          }
          done++;
          toast.loading(t('progress', { done, total: items.length }), { id });
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
      onDone();
      const summary = t('summary', counts);
      if (counts.failed === 0) toast.success(summary, { id, duration: 5000 });
      else if (counts.failed < done) toast.warning(summary, { id, duration: 5000 });
      else toast.error(summary, { id, duration: 5000 });
      if (!cancelled.current) setRunning(false);
    },
    [concurrency, send, onDone, t, toastError],
  );

  return { run, running };
}
