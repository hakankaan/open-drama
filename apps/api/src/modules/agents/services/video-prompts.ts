import type {
  StartVideoPromptBatch,
  TextModelOverride,
  VideoPromptBatchStarted,
} from '@open-drama/contracts';
import type { z } from 'zod';
import { ApiError, invalid, precondition } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { getEpisodeJobs, runJob } from '../../jobs/run-job';
import { getEpisodeRow } from '../../production/episodes';
import { assertNoBreakdown, getShotRow, liveShotRows } from '../../storyboard/service';
import { runAgentUntilSaved } from '../runtime/run-agent';
import { videoModelLabel } from './video-model';

/** Single-shot prompt runs in flight per episode; a breakdown waits for them (it would replace their shots). */
const promptRuns = new Map<number, number>();
export const promptRunsInFlight = (episodeId: number) => (promptRuns.get(episodeId) ?? 0) > 0;

/**
 * GenerateShotVideoPrompt: the prompt generator writes one shot's video prompt and saves it through update_shot
 * (videoPrompt only). Succeeds only when a non-empty prompt was persisted.
 */
export async function generateShotVideoPrompt(
  shotId: number,
  opts: z.input<typeof TextModelOverride> = {},
): Promise<string> {
  const shot = getShotRow(shotId);
  const ep = getEpisodeRow(shot.episodeId);
  assertNoBreakdown(ep.id);
  const videoModel = videoModelLabel(ep.videoServiceId);
  promptRuns.set(ep.id, (promptRuns.get(ep.id) ?? 0) + 1);
  try {
    await runAgentUntilSaved(
      {
        agentType: 'prompt_generator',
        message: `Write the video prompt for shot #${shot.shotNumber} (id ${shot.id}) for the video model ${videoModel}. Read the shot with read_storyboard_context using shotId ${shot.id}, then save only its videoPrompt with update_shot.`,
        episodeId: ep.id,
        dramaId: ep.dramaId,
        target: { kind: 'shot', id: shot.id },
        ...opts,
      },
      'update_shot',
    );
  } finally {
    promptRuns.set(ep.id, (promptRuns.get(ep.id) ?? 1) - 1);
  }
  const saved = getShotRow(shotId).videoPrompt.trim();
  if (!saved)
    throw new ApiError(
      'PROVIDER_ERROR',
      'The agent saved an empty video prompt. Try again or pick another model.',
    );
  return saved;
}

/**
 * StartVideoPromptBatch → VideoPromptBatch job: the given shots, or every live shot without a prompt, one agent run
 * each, with progress (total, completed, failed, currentShotId). Fails only when no prompt was saved.
 */
export function startVideoPromptBatch(
  episodeId: number,
  body: z.output<typeof StartVideoPromptBatch>,
): VideoPromptBatchStarted {
  const ep = getEpisodeRow(episodeId);
  assertNoBreakdown(ep.id);
  const { shotIds, ...opts } = body;
  const live = liveShotRows(ep.id);
  let targets = live.filter((s) => !s.videoPrompt.trim());
  if (shotIds) {
    const known = new Set(live.map((s) => s.id));
    const unknown = shotIds.filter((id) => !known.has(id));
    if (unknown.length > 0) throw invalid(`No shot ${unknown.join(', ')} in this episode`);
    const wanted = new Set(shotIds);
    targets = live.filter((s) => wanted.has(s.id));
  }
  const running = getEpisodeJobs(ep.id).videoPromptBatch;
  if (targets.length === 0 && running?.status !== 'running')
    throw precondition('Every shot already has a video prompt');

  const total = targets.length;
  const started = runJob(
    { kind: 'videoPromptBatch', episodeId: ep.id, dramaId: ep.dramaId },
    async ({ progress }) => {
      const state = { total, completed: 0, failed: 0, currentShotId: null as number | null };
      progress(state);
      for (const shot of targets) {
        progress({ ...state, currentShotId: shot.id });
        try {
          await generateShotVideoPrompt(shot.id, opts);
          state.completed++;
        } catch (err) {
          state.failed++;
          logger.warn(
            { episodeId: ep.id, shotId: shot.id, err: (err as Error).message },
            'video prompt failed in batch',
          );
        }
      }
      progress({ ...state, currentShotId: null });
      if (state.completed === 0)
        throw new Error(
          `No video prompt was saved (${state.failed} failed). Try again or pick another model.`,
        );
    },
  );
  if (!started.alreadyRunning) return { ...started, total };
  return { ...started, total: Number(getEpisodeJobs(ep.id).videoPromptBatch?.progress.total ?? 0) };
}
