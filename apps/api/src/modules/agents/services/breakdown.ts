import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import { isNarrator, type TextModelOverride } from '@open-drama/contracts';
import type { z } from 'zod';
import { db } from '../../../db/client';
import { characters, episodeCharacters, episodeProps, episodeScenes, films, generationTasks, shots } from '../../../db/schema';
import { conflict, precondition } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { getEpisodeJobs, runJob } from '../../jobs/run-job';
import { getEpisodeRow } from '../../production/episodes';
import { liveShotRows, purgeParkedShots, restoreParkedShots } from '../../storyboard/service';
import { runAgentUntilDone } from '../runtime/run-agent';
import { breakdownFinished, forgetBreakdown } from '../tools/storyboard';
import { describeVideoModel } from './video-model';
import { promptRunsInFlight } from './video-prompts';

const shotsWrittenBy = (jobId: number) =>
  db.select({ n: count() }).from(shots).where(eq(shots.createdByJobId, jobId)).get()?.n ?? 0;

/** Bindings need candidates (domain precondition "Assets have been extracted"). */
function hasAssetCandidates(episodeId: number): boolean {
  const linkedChars = db
    .select({ name: characters.name, role: characters.role })
    .from(episodeCharacters)
    .innerJoin(characters, eq(characters.id, episodeCharacters.characterId))
    .where(and(eq(episodeCharacters.episodeId, episodeId), isNull(characters.deletedAt)))
    .all();
  if (linkedChars.some((c) => !isNarrator(c.name, c.role))) return true;
  const n = (table: typeof episodeScenes | typeof episodeProps) =>
    db.select({ n: count() }).from(table).where(eq(table.episodeId, episodeId)).get()?.n ?? 0;
  return n(episodeScenes) + n(episodeProps) > 0;
}

/**
 * BreakdownStoryboard → StoryboardBreakdown job (adr-0008). The agent saves in batches (the first parks the current
 * shots) and marks the last one final. Only then is the job done, and the parked shots are purged in the same
 * transaction; on failure or restart they come back. Missing video prompts are filled by the separate prompt batch.
 */
export function startBreakdown(episodeId: number, opts: z.input<typeof TextModelOverride> = {}) {
  const ep = getEpisodeRow(episodeId);
  if (!ep.scriptContent?.trim()) throw precondition('Finish the script (rewrite or skip) before breaking it into shots');
  if (!hasAssetCandidates(ep.id)) throw precondition('Extract or add the episode’s assets before breaking it into shots');
  const jobs = getEpisodeJobs(ep.id);
  if (jobs.breakdown?.status !== 'running') {
    // A running breakdown is returned below; otherwise nothing may still be writing to the shots it will replace.
    if (jobs.videoPromptBatch?.status === 'running' || promptRunsInFlight(ep.id)) {
      throw conflict('Video prompts are being written; break down once they are done');
    }
    const ids = liveShotRows(ep.id).map((s) => s.id);
    const generating = ids.length
      ? db
          .select({ id: generationTasks.id })
          .from(generationTasks)
          .where(and(eq(generationTasks.type, 'video'), eq(generationTasks.status, 'processing'), inArray(generationTasks.shotId, ids)))
          .get()
      : undefined;
    if (generating) throw conflict('Shot videos are still generating; break down once they have finished');
    const merging = db
      .select({ id: films.id })
      .from(films)
      .where(and(eq(films.episodeId, ep.id), eq(films.status, 'processing')))
      .get();
    if (merging) throw conflict('The episode film is being merged; break down once it has finished', { filmId: merging.id });
  }

  const video = describeVideoModel(ep.videoServiceId);
  const message = [
    `Break this episode's script into shots. The video model is ${video.label}; keep every shot between ${video.min} and ${video.max} seconds.`,
    "Read the script and the project's characters, scenes and props with read_storyboard_context, then save every shot with save_shots in batches of at most 8, in story order. The first batch sets replaceExisting: true and the batch holding the last shot sets final: true. Bind assets only by the ids the context gives, and write each shot's videoPrompt.",
  ].join(' ');
  return runJob(
    { kind: 'breakdown', episodeId: ep.id, dramaId: ep.dramaId },
    async ({ jobId, progress }) => {
      try {
        const run = await runAgentUntilDone(
          { agentType: 'storyboard_breaker', message, episodeId: ep.id, dramaId: ep.dramaId, jobId, ...opts },
          () => breakdownFinished(jobId),
          'saving the final batch of shots (final: true)',
        );
        progress({ steps: run.steps, model: run.model });
      } catch (err) {
        // A provider error after the final batch (the closing reply) does not undo a complete storyboard.
        if (!breakdownFinished(jobId)) throw err;
        logger.warn({ jobId, err: (err as Error).message }, 'breakdown agent failed after its final batch; keeping it');
      } finally {
        forgetBreakdown(jobId);
      }
      const written = shotsWrittenBy(jobId);
      if (written === 0) throw new Error('The agent saved no shots. Try again or pick another model.');
      progress({ shots: written });
    },
    {
      onDone: (jobId, tx) => purgeParkedShots(tx, jobId, ep.id),
      onFailure: (jobId, tx) => restoreParkedShots(tx, jobId, ep.id),
    },
  );
}
