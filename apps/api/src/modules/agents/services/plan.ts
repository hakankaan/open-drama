import type { PlanEpisodes, PlanProgress } from '@open-drama/contracts';
import type { z } from 'zod';
import { conflict, precondition } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { getDramaJobs, runJob } from '../../jobs/run-job';
import { getDramaRow } from '../../production/dramas';
import { lockServices } from '../../production/episodes';
import { runAgentUntilDone } from '../runtime/run-agent';
import { PLAN_BATCH_MAX, planFinished } from '../tools/plan';

/**
 * PlanEpisodes → EpisodePlanJob (adr-0015), drama-scoped. The request, resolved at start, is the job's state on its
 * progress row with the ids written so far; the planner adds episodes batch by batch through save_episodes and the
 * job is done only once it sent final with every requested episode live. A failed plan keeps the episodes it added.
 */
export function startPlan(dramaId: number, input: z.output<typeof PlanEpisodes>) {
  const drama = getDramaRow(dramaId);
  // A retried start answers with the running plan before any start-only precondition (a service switched off
  // meanwhile must not turn the duplicate into a 412); runJob's own lookup still guards the insert.
  const running = getDramaJobs(dramaId).plan;
  if (running?.status === 'running') return { jobId: running.id, alreadyRunning: true };
  const { count, targetDurationSeconds, resolution, model, textServiceId } = input;
  const services = lockServices(input);
  if (!drama.outline.trim() && !drama.description.trim()) {
    throw precondition('Write the story outline or a synopsis before planning episodes');
  }
  if (getDramaJobs(dramaId).outline?.status === 'running') throw conflict('The outline is being written; plan the episodes once it is saved');
  const request: PlanProgress = { count, targetDurationSeconds: targetDurationSeconds ?? null, resolution, ...services, written: [] };
  const length = targetDurationSeconds ? ` Each episode runs ${targetDurationSeconds} seconds on screen; size its beats to that.` : '';
  const message = `Plan the next ${count} ${count === 1 ? 'episode' : 'episodes'} of this project.${length} Read the premise, the outline and the existing episodes with read_story_for_planning, write each new episode's title, synopsis and beat sheet following your skills, continuing from the last existing episode, and add them with save_episodes in story order in batches of at most ${PLAN_BATCH_MAX}, setting final: true on the batch that completes the ${count}.`;
  return runJob(
    { kind: 'plan', dramaId, episodeId: null },
    async ({ jobId, progress }) => {
      try {
        const run = await runAgentUntilDone(
          { agentType: 'episode_planner', message, dramaId, jobId, model, textServiceId },
          () => planFinished(jobId),
          'saving the final batch of episodes (final: true)',
        );
        progress({ ...request, written: latestWritten(dramaId, jobId), final: true, steps: run.steps, model: run.model });
      } catch (err) {
        // A provider error after the final batch (the closing reply) does not undo a complete plan.
        if (!planFinished(jobId)) throw err;
        logger.warn({ jobId, err: (err as Error).message }, 'planner failed after its final batch; keeping the plan');
      }
    },
    { initialProgress: request },
  );
}

/** The ids the batches wrote, as the row holds them now (the progress written at the end must keep them). */
function latestWritten(dramaId: number, jobId: number): number[] {
  const job = getDramaJobs(dramaId).plan;
  const written = job?.id === jobId ? job.progress.written : undefined;
  return Array.isArray(written) ? (written as number[]) : [];
}
