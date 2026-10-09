'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  EpisodeShotList,
  ShotCard,
  ShotVideo,
  ShotVideoStarted,
  VideoPromptBatchStarted,
  VideoPromptResult,
  JobStarted,
  type CreateShot,
  type RequestShotVideo,
  type StartVideoPromptBatch,
  type TextModelOverride,
  type UpdateShot,
} from '@open-drama/contracts';
import { request } from '@/lib/api';
import { generationKeys } from '../generation/api';
import { productionKeys } from '../production/api';

export const storyboardKeys = {
  shots: (episodeId: number) => ['storyboard', 'shots', episodeId] as const,
  videos: (shotId: number) => ['storyboard', 'videos', shotId] as const,
};

/** Polling (Plan 3 §4.7): while a shot video generates, or the breakdown or prompt batch runs (their results land here). */
const active = (d: EpisodeShotList | undefined) =>
  !!d &&
  (d.breakdown?.status === 'running' ||
    d.videoPromptBatch?.status === 'running' ||
    d.shots.some((s) => s.latestVideoTask?.status === 'processing'));

/** EpisodeShotList: the single source of every shot's state in the video stage. */
export const useEpisodeShots = (episodeId: number) =>
  useQuery({
    queryKey: storyboardKeys.shots(episodeId),
    queryFn: () => request(EpisodeShotList, 'GET', `/episodes/${episodeId}/shots`),
    refetchInterval: (query) => (active(query.state.data) ? 4000 : false),
  });

export function useInvalidateEpisode(episodeId: number) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: storyboardKeys.shots(episodeId) });
    void qc.invalidateQueries({ queryKey: productionKeys.jobs(episodeId) });
    void qc.invalidateQueries({ queryKey: productionKeys.pipeline(episodeId) });
    // The task drawer's badge only polls while it knows of running work.
    void qc.invalidateQueries({ queryKey: generationKeys.episodeTasks(episodeId) });
  };
}

export function useStartBreakdown(episodeId: number) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useMutation({
    mutationFn: (body: TextModelOverride) => request(JobStarted, 'POST', `/episodes/${episodeId}/breakdown`, body),
    onSettled: invalidate,
  });
}

export function useStartVideoPromptBatch(episodeId: number) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useMutation({
    mutationFn: (body: StartVideoPromptBatch) =>
      request(VideoPromptBatchStarted, 'POST', `/episodes/${episodeId}/video-prompts`, body),
    onSettled: invalidate,
  });
}

/** Writes the returned card into the list, so an awaited save shows the server's version at once. */
function usePutCard(episodeId: number) {
  const qc = useQueryClient();
  return (card: ShotCard) =>
    qc.setQueryData<EpisodeShotList>(storyboardKeys.shots(episodeId), (list) =>
      list ? { ...list, shots: list.shots.map((s) => (s.id === card.id ? card : s)) } : list,
    );
}

export function useCreateShot(episodeId: number) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useMutation({
    mutationFn: (body: CreateShot) => request(ShotCard, 'POST', '/shots', body),
    onSettled: invalidate,
  });
}

/**
 * A poll of the list already in flight answers with the shot as it was before the save, so it is cancelled first;
 * the list is refetched once the save settles.
 */
export function useUpdateShot(episodeId: number) {
  const put = usePutCard(episodeId);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateShot & { id: number }) => request(ShotCard, 'PATCH', `/shots/${id}`, body),
    onMutate: () => qc.cancelQueries({ queryKey: storyboardKeys.shots(episodeId) }),
    onSuccess: (card) => {
      put(card);
      void qc.invalidateQueries({ queryKey: productionKeys.pipeline(episodeId) });
      void qc.invalidateQueries({ queryKey: storyboardKeys.videos(card.id) });
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: storyboardKeys.shots(episodeId) }),
  });
}

export function useDeleteShot(episodeId: number) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useMutation({
    mutationFn: (id: number) => request(z.object({ id: z.number() }), 'DELETE', `/shots/${id}`),
    onSettled: invalidate,
  });
}

/** GenerateShotVideoPrompt (synchronous agent run); the list is refreshed with the saved prompt. */
export function useGenerateShotVideoPrompt(episodeId: number) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useMutation({
    mutationFn: ({ id, ...body }: TextModelOverride & { id: number }) =>
      request(VideoPromptResult, 'POST', `/shots/${id}/video-prompt`, body),
    onSettled: invalidate,
  });
}

/** RequestShotVideo without the refresh, for a batch that refreshes once at the end. */
export const requestShotVideo = ({ id, ...body }: RequestShotVideo & { id: number }) =>
  request(ShotVideoStarted, 'POST', `/shots/${id}/video`, body);

/** RequestShotVideo: the shot follows the task through the polled list (latestVideoTask). */
export function useRequestShotVideo(episodeId: number) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useMutation({ mutationFn: requestShotVideo, onSettled: invalidate });
}

/** Completed videos of a shot. The key includes the latest task, so a finished generation refreshes the history. */
export const useShotVideos = (shotId: number, latestTaskKey: string) =>
  useQuery({
    queryKey: [...storyboardKeys.videos(shotId), latestTaskKey],
    queryFn: () => request(z.array(ShotVideo), 'GET', `/shots/${shotId}/videos`),
  });

export function useDeleteTask(episodeId: number) {
  const qc = useQueryClient();
  const invalidate = useInvalidateEpisode(episodeId);
  return useMutation({
    mutationFn: (taskId: number) => request(z.object({ id: z.number() }), 'DELETE', `/generation-tasks/${taskId}`),
    onSettled: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: ['storyboard', 'videos'] });
    },
  });
}
