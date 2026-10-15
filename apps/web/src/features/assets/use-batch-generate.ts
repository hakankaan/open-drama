'use client';

import { useBatchRunner } from '@/lib/use-batch-runner';
import { imageOverride, type ModelPicks } from '../configuration/model-picks';
import { requestAssetImage, useInvalidateAssets } from './api';
import type { GeneratedView } from '@open-drama/contracts';
import { viewsBody, type AnyAsset } from './model';

/**
 * Client-side batch (Plan 3 §4.5, UI rules): one request per asset, at most 3 in flight, each tracked by the
 * polled asset list; a 409 means that asset is already generating and is not retried. A character draws the given
 * `views`, else its headshot and the views drawn from it (adr-0018).
 */
export function useBatchGenerate(dramaId: number, episodeId: number, picks: ModelPicks) {
  const invalidate = useInvalidateAssets(dramaId);
  return useBatchRunner({
    namespace: 'assets.batch',
    concurrency: 3,
    send: (item: AnyAsset & { views?: GeneratedView[] }) =>
      requestAssetImage({ kind: item.kind, id: item.asset.id, body: { episodeId, ...imageOverride(picks), ...viewsBody(item, item.views) } }),
    onDone: invalidate,
  });
}
