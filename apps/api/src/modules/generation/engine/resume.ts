import { and, eq, not } from 'drizzle-orm';
import { db } from '../../../db/client';
import { generationTasks, modelServices, shots } from '../../../db/schema';
import { logger } from '../../../http/logger';
import { rememberSecret } from '../../../lib/secrets';
import { imageAdapterFor, lipSyncAdapterFor, speechAdapterFor, videoAdapterFor } from '../adapters/registry';
import type { ServiceConfig } from '../adapters/types';
import { ConfigError } from './errors';
import { completeImage, IMAGE_POLL, imageOwnerOf } from './images';
import { detach, failTask, poll, type PollProfile } from './lifecycle';
import { completeLipSync, LIPSYNC_POLL } from './lipsync';
import { completeSpeech, SPEECH_POLL } from './speech';
import { completeVideo, perEpisode, VIDEO_POLL, WAITING_TO_CONTINUE } from './videos';

type TaskRow = typeof generationTasks.$inferSelect;

/**
 * ResumeInterruptedTasks (adr-0005): a task the provider had accepted before a restart is already paid for, so it is
 * polled again instead of failed (boot cleanup keeps exactly these processing). Its service row gives the address
 * and key; neither can have moved to another host or provider without the key being entered again
 * (assertKeyFollows). A task whose service is gone, keyless or now another provider fails as before. Its time budget
 * runs from its submission, so restarts never extend it, and its owner gets the result only if it still exists.
 */
export function resumeInterrupted(): { resumed: number } {
  // A video waiting to continue the shot before it was never sent: resumeWaitingContinuations dispatches it again.
  const tasks = db.select().from(generationTasks).where(and(eq(generationTasks.status, 'processing'), not(WAITING_TO_CONTINUE))).all();
  for (const task of tasks) {
    try {
      resume(task);
    } catch (err) {
      failTask(task.id, err, WHAT[task.type]);
    }
  }
  return { resumed: tasks.length };
}

const WHAT: Record<TaskRow['type'], string> = { image: 'image', video: 'video', speech: 'speech', lipsync: 'lip sync' };

function resume(task: TaskRow) {
  const what = WHAT[task.type];
  const providerTaskId = task.providerTaskId;
  if (!providerTaskId) throw new ConfigError('Interrupted by a server restart before the provider accepted it');
  const service = task.serviceId ? db.select().from(modelServices).where(eq(modelServices.id, task.serviceId)).get() : undefined;
  if (!service || service.provider !== task.provider || !service.apiKey) {
    throw new ConfigError('Interrupted by a server restart, and its service was removed or changed meanwhile');
  }
  rememberSecret(service.apiKey);
  const config: ServiceConfig = { provider: task.provider, baseUrl: service.baseUrl, apiKey: service.apiKey, model: task.model };
  const budget = (profile: PollProfile): PollProfile => ({
    ...profile,
    // At least one more look, even when the budget ran out while the server was down.
    maxMs: Math.max(1, profile.maxMs - (Date.now() - Date.parse(task.createdAt))),
  });
  logger.info({ taskId: task.id, providerTaskId, provider: task.provider }, `${what} task resumed after restart`);

  if (task.type === 'image') {
    const owner = imageOwnerOf(task);
    const adapter = imageAdapterFor(task.provider);
    if (!owner || !adapter) throw new ConfigError('Interrupted by a server restart; this task cannot be resumed');
    detach(task.id, what, async () =>
      completeImage(task.id, owner, await poll(adapter, config, task.id, providerTaskId, budget(IMAGE_POLL), what), service.baseUrl),
    );
    return;
  }
  const shotId = task.shotId;
  if (shotId === null) throw new ConfigError('Interrupted by a server restart; this task cannot be resumed');
  // Speech and lip sync take no episode slot.
  if (task.type === 'speech') {
    const adapter = speechAdapterFor(task.provider);
    if (!adapter) throw new ConfigError('Interrupted by a server restart; this task cannot be resumed');
    detach(task.id, what, async () =>
      completeSpeech(task.id, shotId, await poll(adapter, config, task.id, providerTaskId, budget(SPEECH_POLL), what), service.baseUrl),
    );
    return;
  }
  if (task.type === 'lipsync') {
    const adapter = lipSyncAdapterFor(task.provider);
    if (!adapter) throw new ConfigError('Interrupted by a server restart; this task cannot be resumed');
    detach(task.id, what, async () =>
      completeLipSync(task.id, shotId, await poll(adapter, config, task.id, providerTaskId, budget(LIPSYNC_POLL), what), service.baseUrl),
    );
    return;
  }
  const adapter = videoAdapterFor(task.provider);
  if (!adapter) throw new ConfigError('Interrupted by a server restart; this task cannot be resumed');
  const work = async () =>
    completeVideo(task.id, shotId, await poll(adapter, config, task.id, providerTaskId, budget(VIDEO_POLL), what), service.baseUrl);
  // Like a new request, a resumed video waits for its episode's slot; a shot deleted meanwhile has none to wait for.
  const episodeId = db.select({ episodeId: shots.episodeId }).from(shots).where(eq(shots.id, shotId)).get()?.episodeId;
  detach(task.id, what, () => (episodeId === undefined ? work() : perEpisode(episodeId, work)));
}
