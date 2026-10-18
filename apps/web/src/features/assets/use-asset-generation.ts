'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';
import { useToastError } from '@/lib/errors';
import { imageOverride, textOverride, type ModelPicks } from '../configuration/model-picks';
import { useDescribeAsset, useGenerateFinalPrompt, useRequestAssetImage } from './api';
import type { GeneratedView } from '@open-drama/contracts';
import { viewsBody, type AnyAsset } from './model';

const keyOf = (item: AnyAsset) => `${item.kind}:${item.asset.id}`;

/** What a describe resolves to: the asset as described, or null when the run was refused or failed (toasted here). */
export type Described = Awaited<ReturnType<ReturnType<typeof useDescribeAsset>['mutateAsync']>> | null;

/**
 * Single-asset generation: the final prompt (synchronous agent run), the description (the same, by the asset
 * designer, adr-0024) and the image (a task the polled lists follow). In the episode studio the prompt and image
 * requests carry the episode (its context and its locked image service); the project page's library sends none,
 * and the server uses the project's image service instead (adr-0024); a description never needs one. Pending
 * state here only covers the request itself.
 */
export function useAssetGeneration(dramaId: number, episodeId: number | undefined, picks: ModelPicks) {
  const t = useTranslations('assets');
  const toastError = useToastError();
  const finalPrompt = useGenerateFinalPrompt(dramaId);
  const description = useDescribeAsset(dramaId);
  const request = useRequestAssetImage(dramaId);
  const [prompting, setPrompting] = useState<Set<string>>(new Set());
  const [describing, setDescribing] = useState<Set<string>>(new Set());
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
      track(setPrompting, keyOf(item), true);
      try {
        const res = await finalPrompt.mutateAsync({
          kind: item.kind,
          id: item.asset.id,
          body: { ...(episodeId === undefined ? {} : { episodeId }), force: true, ...textOverride(picks) },
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

  /** Fills the empty describing fields from the story, or writes every one afresh with `replace` (adr-0024). */
  const describe = useCallback(
    async (item: AnyAsset, replace: boolean): Promise<Described> => {
      track(setDescribing, keyOf(item), true);
      try {
        return await description.mutateAsync({ kind: item.kind, id: item.asset.id, body: { replace, ...textOverride(picks) } });
      } catch (err) {
        toastError(err);
        return null;
      } finally {
        track(setDescribing, keyOf(item), false);
      }
    },
    [description, picks, toastError],
  );

  /** A character draws `views`, or its headshot and the views drawn from it (adr-0018). */
  const image = useCallback(
    async (item: AnyAsset, views?: GeneratedView[]) => {
      track(setImaging, keyOf(item), true);
      try {
        await request.mutateAsync({
          kind: item.kind,
          id: item.asset.id,
          body: { ...(episodeId === undefined ? {} : { episodeId }), ...imageOverride(picks), ...viewsBody(item, views) },
        });
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
    describe,
    image,
    isPromptPending: (item: AnyAsset) => prompting.has(keyOf(item)),
    isDescribePending: (item: AnyAsset) => describing.has(keyOf(item)),
    isImagePending: (item: AnyAsset) => imaging.has(keyOf(item)),
  };
}
