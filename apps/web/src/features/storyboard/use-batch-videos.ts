'use client';

import { useBatchRunner } from '@/lib/use-batch-runner';
import { requestShotVideo, useInvalidateEpisode } from './api';

/**
 * Batch generation as a client loop (Plan 3 §4.5): one RequestShotVideo per shot, at most 4 in flight, each shot
 * tracked by the polled shot list. A 409 means that shot is already generating and is not retried.
 */
export function useBatchVideos(episodeId: number, override: { model?: string; videoServiceId?: number }) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useBatchRunner({
    namespace: 'studio.video.batch',
    concurrency: 4,
    send: (shotId: number) => requestShotVideo({ id: shotId, ...override }),
    onDone: invalidate,
  });
}
