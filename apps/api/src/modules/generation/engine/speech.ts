import { eq } from 'drizzle-orm';
import { LINE_LEAD_IN_SECONDS, LINE_TAIL_SECONDS, SHOT_DURATION_MAX, type ContentLanguage } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { characters, generationTasks, shots } from '../../../db/schema';
import { ApiError, precondition } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { assertAudio, storeRemoteFile } from '../../media/store';
import { recomputeDuration } from '../../storyboard/service';
import { speechAdapterFor } from '../adapters/registry';
import { ProviderError, type ResultMedia, type SpeechAdapter, type SpeechVoiceInfo } from '../adapters/types';
import { ConfigError, messageOf } from './errors';
import { claimTask, completeTask, detach, generate, recordResultUrl, resolveGeneration, type ResolvedGeneration } from './lifecycle';
import { deliverStoredFile } from './references';

/** Speech polling profile: every 3 s, within 10 minutes. */
export const SPEECH_POLL = { intervalMs: 3_000, attempts: 200, maxMs: 10 * 60_000 };

export type ResolvedSpeech = ResolvedGeneration<SpeechAdapter>;

/** The speech adapter and credentials for a request (explicit service → the highest-priority active one); no episode lock. */
export const resolveSpeech = (opts: { explicitId?: number; model?: string }): ResolvedSpeech =>
  resolveGeneration('speech', speechAdapterFor, opts);

/** The model's voices and whether it clones; a model the adapter cannot drive is refused (412). */
export async function speechVoicesOf(resolved: ResolvedSpeech): Promise<SpeechVoiceInfo> {
  try {
    return await resolved.adapter.describeModel(resolved.model);
  } catch (err) {
    if (err instanceof ConfigError) throw precondition(err.message);
    throw new ApiError('PROVIDER_ERROR', `The voices of ${resolved.model} could not be read: ${messageOf(err)}`);
  }
}

export interface SubmitSpeechInput {
  shotId: number;
  dramaId: number;
  line: string;
  speakerId: number;
  /** The speaker's voice and sample as they were asked for; the audio attaches only while both are unchanged. */
  voice: string;
  voiceSamplePath: string | null;
  /** Whether the sample is cloned (the model clones); otherwise the voice is named. */
  cloned: boolean;
  language: ContentLanguage;
}

/**
 * Stores the speech and makes it the shot's line audio, growing the shot to hold the lead-in, the line and a tail
 * (never shrinking it, at most the longest shot) and marking its video prompt stale when it grew. A line, speaker or
 * voice that changed meanwhile keeps the audio on the task only.
 */
export async function completeSpeech(taskId: number, shotId: number, media: ResultMedia, serviceBaseUrl: string | undefined) {
  recordResultUrl(taskId, media.url);
  const path = media.file ? media.file : media.url ? await storeRemoteFile(media.url, 'audio', serviceBaseUrl) : null;
  if (!path) throw new ProviderError('The provider returned no audio');
  const seconds = await assertAudio(path);
  const task = db.select({ prompt: generationTasks.prompt, params: generationTasks.params }).from(generationTasks).where(eq(generationTasks.id, taskId)).get();
  completeTask(taskId, { localPath: path, durationSeconds: seconds }, (tx) => {
    const shot = tx.select().from(shots).where(eq(shots.id, shotId)).get();
    if (!shot || !task || shot.speakerId === null || shot.speakerId !== task.params.speakerId || shot.line.trim() !== task.prompt) return;
    const speaker = tx.select({ voice: characters.voice, sample: characters.voiceSamplePath }).from(characters).where(eq(characters.id, shot.speakerId)).get();
    if (!speaker || speaker.voice !== task.params.voice || (speaker.sample ?? null) !== (task.params.voiceSamplePath ?? null)) return;
    const fit = Math.min(SHOT_DURATION_MAX, Math.ceil(LINE_LEAD_IN_SECONDS + seconds + LINE_TAIL_SECONDS));
    const grows = fit > shot.durationSeconds;
    tx.update(shots)
      .set({ lineAudioPath: path, lineAudioSeconds: seconds, ...(grows ? { durationSeconds: fit, videoPromptStale: true } : {}) })
      .where(eq(shots.id, shotId))
      .run();
    if (grows) recomputeDuration(tx, shot.episodeId);
  });
  logger.info({ taskId, shotId, path, seconds }, 'speech task completed');
}

/** SubmitSpeech for a shot's line (adr-0021): refused while the line is already being spoken (409), dispatched detached. */
export function submitSpeech(resolved: ResolvedSpeech, input: SubmitSpeechInput): number {
  const taskId = claimTask(
    {
      type: 'speech',
      dramaId: input.dramaId,
      shotId: input.shotId,
      serviceId: resolved.serviceId,
      provider: resolved.provider,
      model: resolved.model,
      prompt: input.line,
      params: {
        speakerId: input.speakerId,
        voice: input.voice,
        voiceSamplePath: input.voiceSamplePath,
        cloned: input.cloned,
        language: input.language,
      },
    },
    { column: generationTasks.shotId, id: input.shotId, busyMessage: 'The line is already being spoken for this shot' },
  );
  logger.info({ taskId, provider: resolved.provider, model: resolved.model, shotId: input.shotId }, 'speech task submitted');
  detach(taskId, 'speech', async () => {
    const sample = input.cloned && input.voiceSamplePath;
    const record = {
      taskId,
      text: input.line,
      voice: input.voice,
      // Offline adapters read the stored path; a provider gets an address it can fetch.
      voiceSample: sample ? (resolved.adapter.generateLocal ? sample : await deliverStoredFile(sample, 'voice sample')) : undefined,
      language: input.language,
    };
    await completeSpeech(taskId, input.shotId, await generate(taskId, resolved, record, SPEECH_POLL, 'speech'), resolved.config?.baseUrl);
  });
  return taskId;
}
