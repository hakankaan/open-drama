'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  EpisodeShotList,
  ShotCard,
  ShotVideo,
  ShotVideoStarted,
  SpeechVoices,
  TaskStarted,
  VideoPromptBatchStarted,
  VideoPromptResult,
  JobStarted,
  Shot,
  type CheckShot,
  type CreateShot,
  type RequestLineAudio,
  type RequestLipSync,
  type RequestShotKeyframe,
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

/**
 * Polling (Plan 3 §4.7): while a shot video, keyframe, line audio or lip sync generates, or the breakdown or prompt
 * batch runs (their results land here).
 */
const active = (d: EpisodeShotList | undefined) =>
  !!d &&
  (d.breakdown?.status === 'running' ||
    d.videoPromptBatch?.status === 'running' ||
    d.shots.some((s) =>
      [s.latestVideoTask, s.latestKeyframeTask, s.latestLineAudioTask, s.latestLipSyncTask].some((t) => t?.status === 'processing'),
    ));

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

/** RequestShotKeyframe without the refresh, for a batch that refreshes once at the end. */
export const requestShotKeyframe = ({ id, ...body }: RequestShotKeyframe & { id: number }) =>
  request(TaskStarted, 'POST', `/shots/${id}/keyframe`, body);

/** RequestShotKeyframe: the shot follows the task through the polled list (latestKeyframeTask). */
export function useRequestShotKeyframe(episodeId: number) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useMutation({ mutationFn: requestShotKeyframe, onSettled: invalidate });
}

/** RequestLineAudio (adr-0021): the shot follows the task through the polled list (latestLineAudioTask). */
export function useRequestLineAudio(episodeId: number) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useMutation({
    mutationFn: ({ id, ...body }: RequestLineAudio & { id: number }) => request(TaskStarted, 'POST', `/shots/${id}/line-audio`, body),
    onSettled: invalidate,
  });
}

/** RequestLipSync (adr-0021): the shot follows the task through the polled list (latestLipSyncTask). */
export function useRequestLipSync(episodeId: number) {
  const invalidate = useInvalidateEpisode(episodeId);
  return useMutation({
    mutationFn: ({ id, ...body }: RequestLipSync & { id: number }) => request(TaskStarted, 'POST', `/shots/${id}/lip-sync`, body),
    onSettled: invalidate,
  });
}

/** CheckShot (adr-0022): answers once the vision model has looked and the check is stored on the shot. */
export const checkShot = ({ id, ...body }: CheckShot & { id: number }) => request(Shot, 'POST', `/shots/${id}/qa`, body);

/** What the speech service reads lines in (adr-0021); the catalog behind it changes rarely. */
export const useSpeechVoices = () =>
  useQuery({
    queryKey: ['storyboard', 'speech-voices'],
    queryFn: () => request(SpeechVoices, 'GET', '/speech/voices'),
    staleTime: 5 * 60_000,
  });

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
