'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { useToastError } from '@/lib/errors';
import { useRequestShotVideo } from './api';

const CONCURRENCY = 4;

/**
 * Batch generation as a client loop (Plan 3 §4.5): one RequestShotVideo per shot, at most 4 in flight, each shot
 * tracked by the polled shot list. A 409 means that shot is already generating and is not retried.
 */
export function useBatchVideos(episodeId: number, override: { model?: string; videoServiceId?: number }) {
  const t = useTranslations('studio.video.batch');
  const toastError = useToastError();
  const request = useRequestShotVideo(episodeId);
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);
  // Leaving the page stops queuing; requests already sent keep running on the server.
  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
    };
  }, []);

  const run = useCallback(
    async (shotIds: number[]) => {
      if (shotIds.length === 0) return;
      setRunning(true);
      const id = toast.loading(t('progress', { done: 0, total: shotIds.length }));
      const counts = { started: 0, already: 0, failed: 0 };
      let done = 0;
      const queue = [...shotIds];
      const worker = async () => {
        for (let shotId = queue.shift(); shotId !== undefined && !cancelled.current; shotId = queue.shift()) {
          try {
            await request.mutateAsync({ id: shotId, ...override });
            counts.started++;
          } catch (err) {
            if (err instanceof ApiError && err.code === 'CONFLICT') counts.already++;
            else {
              counts.failed++;
              if (counts.failed === 1) toastError(err);
            }
          }
          done++;
          toast.loading(t('progress', { done, total: shotIds.length }), { id });
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, shotIds.length) }, worker));
      toast.success(t('summary', counts), { id, duration: 5000 });
      if (!cancelled.current) setRunning(false);
    },
    [request, override, t, toastError],
  );

  return { run, running };
}
