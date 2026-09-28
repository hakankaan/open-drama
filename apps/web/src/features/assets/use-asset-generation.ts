'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { useToastError } from '@/lib/errors';
import { imageOverride, textOverride, type ModelPicks } from '../configuration/model-picks';
import { useGenerateFinalPrompt, useRequestAssetImage } from './api';
import type { AnyAsset } from './model';

const keyOf = (item: AnyAsset) => `${item.kind}:${item.asset.id}`;

/**
 * Single-asset generation in an episode's context: the final prompt (synchronous agent run) and the image
 * (a task the polled lists follow). Pending state here only covers the request itself.
 */
export function useAssetGeneration(dramaId: number, episodeId: number | undefined, picks: ModelPicks) {
  const t = useTranslations('assets');
  const toastError = useToastError();
  const finalPrompt = useGenerateFinalPrompt(dramaId);
  const request = useRequestAssetImage(dramaId);
  const [prompting, setPrompting] = useState<Set<string>>(new Set());
  const [imaging, setImaging] = useState<Set<string>>(new Set());

  const track = (set: typeof setPrompting, key: string, on: boolean) =>
    set((s) => {
      const next = new Set(s);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const prompt = useCallback(
    async (item: AnyAsset): Promise<string | null> => {
      if (!episodeId) return null;
      track(setPrompting, keyOf(item), true);
      try {
        const res = await finalPrompt.mutateAsync({
          kind: item.kind,
          id: item.asset.id,
          body: { episodeId, force: true, ...textOverride(picks) },
        });
        return res.finalPrompt;
      } catch (err) {
        toastError(err);
        return null;
      } finally {
        track(setPrompting, keyOf(item), false);
      }
    },
    [episodeId, finalPrompt, picks, toastError],
  );

  const image = useCallback(
    async (item: AnyAsset) => {
      if (!episodeId) return;
      track(setImaging, keyOf(item), true);
      try {
        await request.mutateAsync({ kind: item.kind, id: item.asset.id, body: { episodeId, ...imageOverride(picks) } });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'CONFLICT') toast.info(t('alreadyGenerating'));
        else toastError(err);
      } finally {
        track(setImaging, keyOf(item), false);
      }
    },
    [episodeId, request, picks, toastError, t],
  );

  return {
    prompt,
    image,
    isPromptPending: (item: AnyAsset) => prompting.has(keyOf(item)),
    isImagePending: (item: AnyAsset) => imaging.has(keyOf(item)),
  };
}
