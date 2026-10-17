'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useBatchRunner } from '@/lib/use-batch-runner';
import { checkShot, requestShotKeyframe, requestShotVideo, storyboardKeys, useInvalidateEpisode } from './api';

/**
 * Batch generation as a client loop (Plan 3 §4.5): one RequestShotVideo per shot, at most 4 in flight, each shot
 * tracked by the polled shot list. A 409 means that shot is already generating and is not retried. A shot that
 * continues the one before (`continued` gives that shot's id) is requested once that shot's request has been answered,
 * so the API finds its video generating and waits for it (adr-0020); the shots go in story order.
 */
export function useBatchVideos(
  episodeId: number,
  override: { model?: string; videoServiceId?: number },
  continued: (shotId: number) => number | null,
) {
  const invalidate = useInvalidateEpisode(episodeId);
  const sent = useRef(new Map<number, Promise<unknown>>());
  const batch = useBatchRunner({
    namespace: 'studio.video.batch',
    concurrency: 4,
    send: (shotId: number) => {
      const before = continued(shotId);
      const prior = before === null ? undefined : sent.current.get(before);
      // Registered before any await, so a later shot of the same take finds it.
      const request = (prior ? prior.catch(() => undefined) : Promise.resolve()).then(() => requestShotVideo({ id: shotId, ...override }));
      sent.current.set(shotId, request);
      return request;
    },
    onDone: invalidate,
  });
  return {
    ...batch,
    run: (shotIds: number[]) => {
      sent.current.clear();
      return batch.run(shotIds);
    },
  };
}

/** Keyframes for many shots, the same way: one RequestShotKeyframe per shot, at most 4 in flight. */
export function useBatchKeyframes(episodeId: number, override: { model?: string; imageServiceId?: number }) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useBatchRunner({
    namespace: 'studio.video.keyframes.batch',
    concurrency: 4,
    send: (shotId: number) => requestShotKeyframe({ id: shotId, ...override }),
    onDone: invalidate,
  });
}

/**
 * Shot checks (adr-0022): one CheckShot per shot, at most 2 in flight, each answered once the vision model has looked.
 * `checking` holds the shots being looked at, by `one` or by the batch.
 */
export function useShotChecks(episodeId: number) {
  const qc = useQueryClient();
  const [checking, setChecking] = useState<ReadonlySet<number>>(new Set());
  const send = async (shotId: number) => {
    setChecking((s) => new Set(s).add(shotId));
    try {
      return await checkShot({ id: shotId });
    } finally {
      setChecking((s) => {
        const next = new Set(s);
        next.delete(shotId);
        return next;
      });
    }
  };
  const refresh = () => void qc.invalidateQueries({ queryKey: storyboardKeys.shots(episodeId) });
  const batch = useBatchRunner({ namespace: 'studio.video.qa.batch', concurrency: 2, send, onDone: refresh });
  return {
    ...batch,
    checking,
    one: async (shotId: number) => {
      await send(shotId);
      refresh();
    },
  };
}
