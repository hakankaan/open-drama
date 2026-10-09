import type { PlanEpisodes, PlanProgress } from '@open-drama/contracts';
import type { z } from 'zod';
import { conflict, precondition } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { getDramaJobs, runJob } from '../../jobs/run-job';
import { getDramaRow } from '../../production/dramas';
import { lockServices } from '../../production/episodes';
import { runAgentUntilDone } from '../runtime/run-agent';
import { PLAN_BATCH_MAX, planFinished, planRemaining } from '../tools/plan';

/**
 * PlanEpisodes → EpisodePlanJob (adr-0015), drama-scoped. The request, resolved at start, is the job's state on its
 * progress row with the ids written so far; the planner adds episodes through save_episodes, one agent run per batch, and the
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
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const batchMessage = (batch: number, remaining: number) =>
    batch === 0
      ? 'Every requested episode of this plan exists. Confirm it with one save_episodes call with final: true and no episodes.'
      : `This project's plan asks for ${count} new ${plural(count, 'episode', 'episodes')}; ${remaining} still ${plural(remaining, 'needs', 'need')} planning.${length} Read the premise, the outline and the existing episodes with read_story_for_planning, write the next ${batch} ${plural(batch, 'episode', 'episodes')} (title, synopsis and beat sheet) following your skills, continuing from the last existing episode, and add them with one save_episodes call in story order${batch === remaining ? ', setting final: true, since they complete the plan' : ''}. Stop after that call: the next batch is planned separately.`;
  return runJob(
    { kind: 'plan', dramaId, episodeId: null },
    async ({ jobId, progress, signal }) => {
      let steps = 0;
      let lastModel: string | undefined;
      try {
        // One fresh run per batch, each reading the story as it now stands: its context holds one batch of beat
        // sheets instead of every sheet the plan wrote so far. Each run adds at least one episode or fails.
        for (let remaining = planRemaining(jobId); remaining !== null && !planFinished(jobId); remaining = planRemaining(jobId)) {
          const batch = Math.min(PLAN_BATCH_MAX, remaining);
          const run = await runAgentUntilDone(
            { agentType: 'episode_planner', message: batchMessage(batch, remaining), dramaId, jobId, model, textServiceId, signal },
            (calls) => planFinished(jobId) || calls.some((c) => c.tool === 'save_episodes' && c.ok),
            batch === remaining ? 'saving the final batch of episodes (final: true)' : 'saving the next batch of episodes',
          );
          steps += run.steps;
          lastModel = run.model;
        }
        if (!planFinished(jobId)) throw new Error('The plan job stopped before every episode was planned');
        progress({ ...request, written: latestWritten(dramaId, jobId), final: true, steps, model: lastModel });
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
