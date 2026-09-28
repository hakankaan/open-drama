import { eq } from 'drizzle-orm';
import { videoCapsFor, type AspectRatio, type Resolution, type VideoProviderCaps } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { generationTasks, shots } from '../../../db/schema';
import { nowIso } from '../../../db/schema/columns';
import { logger } from '../../../http/logger';
import { assertVideo, deriveRenditions, storeRemoteFile } from '../../media/store';
import { videoAdapterFor } from '../adapters/registry';
import { ProviderError, type ResultMedia, type VideoAdapter } from '../adapters/types';
import { claimTask, detach, generate, resolveGeneration, type ResolvedGeneration, type Tx } from './lifecycle';
import { normalizeReferenceImages, resolvePublicMediaUrls } from './references';

/** Video polling profile (adr-0005): every 10 s, at most 300 attempts. */
const POLL = { intervalMs: 10_000, attempts: 300, maxMs: 55 * 60_000 };

export type ResolvedVideo = ResolvedGeneration<VideoAdapter> & { caps: VideoProviderCaps };

/** The video adapter, credentials and reference limits for a request (explicit → episode lock → active). */
export function resolveVideo(opts: { explicitId?: number; lockedId?: number | null; model?: string }): ResolvedVideo {
  const resolved = resolveGeneration('video', videoAdapterFor, opts);
  return { ...resolved, caps: videoCapsFor(resolved.provider) };
}

export interface SubmitVideoInput {
  shotId: number;
  dramaId: number;
  /** Mentions already rendered through the adapter. */
  prompt: string;
  /** Reference images in slot order (stored paths or URLs), within the provider's limit. */
  referenceImages: string[];
  referenceVideos: string[];
  referenceAudios: string[];
  durationSeconds: number;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  generateAudio: boolean;
  /** Recorded on the task for the UI (slots, unmatched mentions). */
  params: Record<string, unknown>;
}

/** AttachShotVideoOnGeneration: the finished clip becomes the shot's current video. A deleted shot is left alone. */
function writeBack(tx: Tx, shotId: number, path: string, durationSeconds: number) {
  tx.update(shots).set({ videoPath: path, videoDurationSeconds: durationSeconds }).where(eq(shots.id, shotId)).run();
}

async function complete(taskId: number, shotId: number, media: ResultMedia) {
  const path = media.file ? media.file : media.url ? await storeRemoteFile(media.url, 'video') : null;
  if (!path) throw new ProviderError('The provider returned no video');
  const durationSeconds = await assertVideo(path);
  await deriveRenditions(path, 'video');
  db.transaction((tx) => {
    tx.update(generationTasks)
      .set({ status: 'completed', localPath: path, resultUrl: media.url ?? null, durationSeconds, completedAt: nowIso() })
      .where(eq(generationTasks.id, taskId))
      .run();
    writeBack(tx, shotId, path, durationSeconds);
  });
  logger.info({ taskId, shotId, path, durationSeconds }, 'video task completed');
}

async function run(taskId: number, resolved: ResolvedVideo, input: SubmitVideoInput) {
  const record = {
    taskId,
    prompt: input.prompt,
    referenceImages: await normalizeReferenceImages(input.referenceImages, resolved.caps.images),
    referenceVideos: resolvePublicMediaUrls(input.referenceVideos, 'video'),
    referenceAudios: resolvePublicMediaUrls(input.referenceAudios, 'audio'),
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    generateAudio: input.generateAudio,
  };
  await complete(taskId, input.shotId, await generate(taskId, resolved, record, POLL, 'video'));
}

/**
 * SubmitVideoGeneration for a shot (adr-0005): refuses while the shot already has a video task processing, records
 * the task and dispatches it detached. Limits are validated by the caller (RequestShotVideo) against `resolved.caps`.
 */
export function submitShotVideo(resolved: ResolvedVideo, input: SubmitVideoInput): number {
  const taskId = claimTask(
    {
      type: 'video',
      dramaId: input.dramaId,
      shotId: input.shotId,
      serviceId: resolved.serviceId,
      provider: resolved.provider,
      model: resolved.model,
      prompt: input.prompt,
      params: {
        ...input.params,
        durationSeconds: input.durationSeconds,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution,
        generateAudio: input.generateAudio,
        references: { images: input.referenceImages.length, videos: input.referenceVideos.length, audios: input.referenceAudios.length },
      },
    },
    { column: generationTasks.shotId, id: input.shotId, busyMessage: 'A video is already being generated for this shot' },
  );
  logger.info({ taskId, provider: resolved.provider, model: resolved.model, shotId: input.shotId }, 'video task submitted');
  detach(taskId, 'video', () => run(taskId, resolved, input));
  return taskId;
}
