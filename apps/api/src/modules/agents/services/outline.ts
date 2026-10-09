import type { TextModelOverride } from '@open-drama/contracts';
import type { z } from 'zod';
import { runJob } from '../../jobs/run-job';
import { getDramaRow } from '../../production/dramas';
import { runAgentUntilSaved } from '../runtime/run-agent';

const MESSAGE =
  "Read the project with read_story, write its story outline following your skills (logline, cast, world and tone, the story in acts, the season shape and, for a serial drama, the threads that carry across episodes), then save it with save_outline. The current outline, when there is one, is draft notes to rewrite from, and the episodes already written or planned are fixed: the outline must agree with them.";

/**
 * WriteOutline → OutlineJob (adr-0015), drama-scoped. The outline is replaced only by save_outline, so a failed run
 * keeps the old one. One outline job per drama; a running one is returned (alreadyRunning).
 */
export function startOutline(dramaId: number, opts: z.input<typeof TextModelOverride> = {}) {
  getDramaRow(dramaId);
  return runJob({ kind: 'outline', dramaId, episodeId: null }, async ({ jobId, progress }) => {
    const run = await runAgentUntilSaved({ agentType: 'story_writer', message: MESSAGE, dramaId, jobId, ...opts }, 'save_outline');
    progress({ steps: run.steps, model: run.model });
  });
}
