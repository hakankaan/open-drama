'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { useToastError } from '@/lib/errors';
import { imageOverride, type ModelPicks } from '../configuration/model-picks';
import { useRequestAssetImage } from './api';
import type { AnyAsset } from './model';

const CONCURRENCY = 3;

/**
 * Client-side batch (Plan 3 §4.5, UI rules): one request per asset, at most 3 in flight, each tracked by the
 * polled asset list; a 409 means that asset is already generating and is not retried.
 */
export function useBatchGenerate(dramaId: number, episodeId: number, picks: ModelPicks) {
  const t = useTranslations('assets.batch');
  const toastError = useToastError();
  const request = useRequestAssetImage(dramaId);
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
    async (items: AnyAsset[]) => {
      if (items.length === 0) return;
      setRunning(true);
      const id = toast.loading(t('progress', { done: 0, total: items.length }));
      const counts = { started: 0, already: 0, failed: 0 };
      let done = 0;
      const queue = [...items];
      const worker = async () => {
        for (let item = queue.shift(); item && !cancelled.current; item = queue.shift()) {
          try {
            await request.mutateAsync({ kind: item.kind, id: item.asset.id, body: { episodeId, ...imageOverride(picks) } });
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
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
      toast.success(t('summary', counts), { id });
      if (!cancelled.current) setRunning(false);
    },
    [request, episodeId, picks, t, toastError],
  );

  return { run, running };
}
