import { eq } from 'drizzle-orm';
import { videoCapsFor, type AspectRatio, type Resolution, type VideoProviderCaps } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { episodes, generationTasks, shots } from '../../../db/schema';
import { nowIso } from '../../../db/schema/columns';
import { env } from '../../../env';
import { logger } from '../../../http/logger';
import { keyedLimiter } from '../../../lib/limiter';
import { assertVideo, deriveRenditions, storeRemoteFile } from '../../media/store';
import { precondition } from '../../../http/errors';
import { videoAdapterFor } from '../adapters/registry';
import { ProviderError, type FormatMention, type ResultMedia, type VideoAdapter } from '../adapters/types';
import { ConfigError } from './errors';
import { claimTask, detach, generate, resolveGeneration, type ResolvedGeneration, type Tx } from './lifecycle';
import { normalizeReferenceImages, resolvePublicMediaUrls } from './references';

/** Video polling profile (adr-0005): every 10 s, at most 300 attempts. */
const POLL = { intervalMs: 10_000, attempts: 300, maxMs: 55 * 60_000 };

/** At most OPEN_DRAMA_VIDEO_CONCURRENCY shot videos of one episode talk to the provider at once. */
const perEpisode = keyedLimiter(env.OPEN_DRAMA_VIDEO_CONCURRENCY);

export type ResolvedVideo = ResolvedGeneration<VideoAdapter> & { caps: VideoProviderCaps; formatMention: FormatMention };

/**
 * What a model accepts and how its prompts address references: the caps table, overlaid with what the adapter reads
 * from the provider (adr-0013 amendment 5). A model the adapter cannot drive is refused (412); when its description
 * cannot be read the table stands in, and the request itself reads it again before anything is paid.
 */
export async function videoModelLimits(
  adapter: VideoAdapter,
  provider: string,
  model: string,
): Promise<{ caps: VideoProviderCaps; formatMention: FormatMention }> {
  const caps = videoCapsFor(provider, model);
  if (!adapter.describeModel) return { caps, formatMention: adapter.formatMention };
  try {
    const learned = await adapter.describeModel(model);
    return { caps: { ...caps, ...learned.caps }, formatMention: learned.formatMention ?? adapter.formatMention };
  } catch (err) {
    if (err instanceof ConfigError) throw precondition(err.message);
    logger.warn({ provider, model, err: (err as Error).message }, 'video model limits could not be read; using the caps table');
    return { caps, formatMention: adapter.formatMention };
  }
}

/** The video adapter, credentials and the model's limits for a request (explicit → episode lock → active). */
export async function resolveVideo(opts: { explicitId?: number; lockedId?: number | null; model?: string }): Promise<ResolvedVideo> {
  const resolved = resolveGeneration('video', videoAdapterFor, opts);
  return { ...resolved, ...(await videoModelLimits(resolved.adapter, resolved.provider, resolved.model)) };
}

/** What a model accepts, for the studio's pickers (`GET /video-models/caps`); in stub mode, the offline adapter's. */
export async function videoCapsOf(provider: string, model?: string): Promise<VideoProviderCaps> {
  const adapter = videoAdapterFor(provider);
  if (!adapter || !model) return videoCapsFor(adapter?.provider ?? provider, model);
  return (await videoModelLimits(adapter, adapter.provider, model)).caps;
}

export interface SubmitVideoInput {
  shotId: number;
  episodeId: number;
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

async function complete(taskId: number, shotId: number, media: ResultMedia, serviceBaseUrl: string | undefined) {
  const path = media.file ? media.file : media.url ? await storeRemoteFile(media.url, 'video', serviceBaseUrl) : null;
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

/**
 * A task may have waited minutes for a slot, or seconds preparing references: before anything is sent (and billed)
 * it re-checks that it is still wanted. False when the task no longer runs; throws when its shot or episode was deleted meanwhile.
 */
function stillWanted(taskId: number, shotId: number): boolean {
  const task = db.select({ status: generationTasks.status }).from(generationTasks).where(eq(generationTasks.id, taskId)).get();
  if (task?.status !== 'processing') return false;
  const owner = db
    .select({ deletedAt: episodes.deletedAt })
    .from(shots)
    .innerJoin(episodes, eq(episodes.id, shots.episodeId))
    .where(eq(shots.id, shotId))
    .get();
  if (!owner || owner.deletedAt) throw new Error('The shot was deleted before its turn came; nothing was sent to the provider');
  return true;
}

async function run(taskId: number, resolved: ResolvedVideo, input: SubmitVideoInput) {
  if (!stillWanted(taskId, input.shotId)) return;
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
  // Preparing the references can take a while too: check once more right before the provider is paid.
  if (!stillWanted(taskId, input.shotId)) return;
  await complete(taskId, input.shotId, await generate(taskId, resolved, record, POLL, 'video'), resolved.config?.baseUrl);
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
  detach(taskId, 'video', () =>
    perEpisode(input.episodeId, () => run(taskId, resolved, input), () =>
      logger.info({ taskId, episodeId: input.episodeId, limit: env.OPEN_DRAMA_VIDEO_CONCURRENCY }, 'video task waiting for a slot'),
    ),
  );
  return taskId;
}
