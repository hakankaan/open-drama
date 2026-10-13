import type { StartTextRun } from '@open-drama/contracts';
import type { z } from 'zod';
import { conflict, precondition } from '../../../http/errors';
import { getDramaJobs, runJob } from '../../jobs/run-job';
import { getDramaRow } from '../../production/dramas';
import { when } from '../../production/episodes';
import { runAgentUntilSaved } from '../runtime/run-agent';

const MESSAGE =
  "Read the project with read_story, write its story outline following your skills (logline, cast, world and tone, the story in acts, the season shape and, for a serial drama, the threads that carry across episodes), then save it with save_outline. The current outline, when there is one, is draft notes to rewrite from, and the episodes already written or planned are fixed: the outline must agree with them.";

/**
 * WriteOutline → OutlineJob (adr-0015), drama-scoped. The outline is replaced only by save_outline, so a failed run
 * keeps the old one. One outline job per drama; a running one is returned (alreadyRunning). Refused while episodes are
 * being planned from the outline, and over a saved outline without `replace` (adr-0016).
 */
export function startOutline(dramaId: number, { replace, ...opts }: z.input<typeof StartTextRun> = {}) {
  const drama = getDramaRow(dramaId);
  const jobs = getDramaJobs(dramaId);
  if (jobs.outline?.status === 'running') return { jobId: jobs.outline.id, alreadyRunning: true };
  if (jobs.plan?.status === 'running') throw conflict('Episodes are being planned from the outline; write it once the plan is done');
  const outline = drama.outline.trim();
  if (!replace && outline) {
    throw precondition(
      `The project already has an outline (${outline.length} characters, revision ${drama.outlineRevision}, changed ${when(drama.updatedAt)}). Rewriting it replaces that text. Call again with replace: true once the creator has agreed.`,
      { outlineChars: outline.length, outlineRevision: drama.outlineRevision, changedAt: drama.updatedAt },
    );
  }
  return runJob({ kind: 'outline', dramaId, episodeId: null }, async ({ jobId, progress, signal }) => {
    const run = await runAgentUntilSaved({ agentType: 'story_writer', message: MESSAGE, dramaId, jobId, signal, ...opts }, 'save_outline');
    progress({ steps: run.steps, model: run.model });
  });
}
