'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  CharacterCard,
  DramaAssetLibrary,
  EpisodeAssets,
  FinalPromptResult,
  JobStarted,
  TaskStarted,
  PropCard,
  SceneCard,
  type AssetKind,
  type CreateCharacter,
  type CreateProp,
  type CreateScene,
  type ExtractionTarget,
  type GenerateFinalPrompt,
  type RequestAssetImage,
  type TextModelOverride,
  type UpdateCharacter,
  type UpdateProp,
  type UpdateScene,
} from '@open-drama/contracts';
import { request } from '@/lib/api';
import { productionKeys } from '../production/api';

const generating = (d: { characters: AnyCard[]; scenes: AnyCard[]; props: AnyCard[] } | undefined) =>
  !!d && [...d.characters, ...d.scenes, ...d.props].some((a) => a.latestImageTask?.status === 'processing');

type AnyCard = { latestImageTask: { status: string } | null };

export const assetKeys = {
  library: (dramaId: number) => ['assets', 'library', dramaId] as const,
  episode: (episodeId: number) => ['assets', 'episode', episodeId] as const,
};

/** Library readiness comes from each card's latest image task; the query polls while any card is generating. */
export const useDramaAssets = (dramaId: number) =>
  useQuery({
    queryKey: assetKeys.library(dramaId),
    queryFn: () => request(DramaAssetLibrary, 'GET', `/dramas/${dramaId}/assets`),
    refetchInterval: (query) => (generating(query.state.data) ? 3000 : false),
  });

/** EpisodeAssets for the studio; polls every 3 s while any card is generating. */
export const useEpisodeAssets = (episodeId: number) =>
  useQuery({
    queryKey: assetKeys.episode(episodeId),
    queryFn: () => request(EpisodeAssets, 'GET', `/episodes/${episodeId}/assets`),
    refetchInterval: (query) => (generating(query.state.data) ? 3000 : false),
  });

export function useStartExtraction(episodeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { target: ExtractionTarget } & TextModelOverride) =>
      request(JobStarted, 'POST', `/episodes/${episodeId}/extract`, body),
    onSettled: () => void qc.invalidateQueries({ queryKey: productionKeys.jobs(episodeId) }),
  });
}

const PATH: Record<AssetKind, string> = { character: '/characters', scene: '/scenes', prop: '/props' };
const CARD = { character: CharacterCard, scene: SceneCard, prop: PropCard } as const;

export type CreateAssetInput =
  | { kind: 'character'; body: CreateCharacter }
  | { kind: 'scene'; body: CreateScene }
  | { kind: 'prop'; body: CreateProp };

export type UpdateAssetInput =
  | { kind: 'character'; id: number; body: UpdateCharacter }
  | { kind: 'scene'; id: number; body: UpdateScene }
  | { kind: 'prop'; id: number; body: UpdateProp };

function useAssetMutation<TVars, TData>(dramaId: number, fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: assetKeys.library(dramaId) });
      void qc.invalidateQueries({ queryKey: ['assets', 'episode'] });
      void qc.invalidateQueries({ queryKey: productionKeys.drama(dramaId) });
      void qc.invalidateQueries({ queryKey: productionKeys.dramas });
      void qc.invalidateQueries({ queryKey: ['production', 'pipeline'] });
    },
  });
}

export const useCreateAsset = (dramaId: number) =>
  useAssetMutation(dramaId, (input: CreateAssetInput) => request(CARD[input.kind], 'POST', PATH[input.kind], input.body));

export const useUpdateAsset = (dramaId: number) =>
  useAssetMutation(dramaId, (input: UpdateAssetInput) =>
    request(CARD[input.kind], 'PATCH', `${PATH[input.kind]}/${input.id}`, input.body),
  );

export const useDeleteAsset = (dramaId: number) =>
  useAssetMutation(dramaId, ({ kind, id }: { kind: AssetKind; id: number }) =>
    request(z.object({ id: z.number() }), 'DELETE', `${PATH[kind]}/${id}`),
  );

/** Generate*FinalPrompt (synchronous agent run). */
export const useGenerateFinalPrompt = (dramaId: number) =>
  useAssetMutation(dramaId, ({ kind, id, body }: { kind: AssetKind; id: number; body: GenerateFinalPrompt }) =>
    request(FinalPromptResult, 'POST', `${PATH[kind]}/${id}/final-prompt`, body),
  );

/** Request*Image: returns the task id; the card follows the task through the polled asset lists. */
export const useRequestAssetImage = (dramaId: number) =>
  useAssetMutation(dramaId, ({ kind, id, body }: { kind: AssetKind; id: number; body: RequestAssetImage }) =>
    request(TaskStarted, 'POST', `${PATH[kind]}/${id}/image`, body),
  );
