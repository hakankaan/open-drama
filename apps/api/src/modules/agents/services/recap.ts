import type { StartTextRun } from '@open-drama/contracts';
import type { z } from 'zod';
import { precondition } from '../../../http/errors';
import { getEpisodeJobs, runJob } from '../../jobs/run-job';
import { getDramaRow } from '../../production/dramas';
import { getEpisodeRow, isRecapStale, when } from '../../production/episodes';
import { runAgentUntilDone } from '../runtime/run-agent';
import { recapRefused } from '../tools/recap';

type Opts = z.input<typeof StartTextRun>;

/** Appended to the rewriter's and breaker's messages, so workspaces with older prompt files still get the pointer. */
export const SERIES_NOTE =
  "The tool result has a `series` block: the project's premise and, for a serial drama, the earlier episodes' recaps (ready, stale or missing). Keep the story continuous with it.";

const MESSAGE =
  "Read this episode's script with read_episode_for_recap, write its recap following your skills, then save it with save_recap. The tool result's `series` block gives the project's premise and the earlier episodes' recaps: use them to keep names and references consistent, but recap only this episode.";

/**
 * WriteRecap → RecapJob (adr-0014). Keyed by the script revision it starts from, so a newer revision's job may start
 * while an older one still runs; the older one's save is refused by save_recap and the job fails at once. A fresh
 * recap (one written for the current script) is rewritten only with `replace` (adr-0016).
 */
export function startRecap(episodeId: number, { replace, ...opts }: Opts = {}) {
  const ep = getEpisodeRow(episodeId);
  if (!getDramaRow(ep.dramaId).serial) {
    throw precondition('Recaps are written for projects whose episodes continue one story; turn that on in the project settings');
  }
  if (!ep.scriptContent?.trim()) throw precondition('Finish the script (rewrite or skip) before writing its recap');
  const scriptRevision = ep.scriptRevision;
  // A retried start answers with the running job for this script before the replace guard.
  const running = getEpisodeJobs(ep.id).recap;
  if (running?.status === 'running' && running.target === String(scriptRevision)) return { jobId: running.id, alreadyRunning: true };
  const recap = ep.recap.trim();
  if (!replace && recap && !isRecapStale(ep)) {
    throw precondition(
      `Episode ${ep.episodeNumber} already has a recap for this script (${recap.length} characters, revision ${ep.recapRevision}, changed ${when(ep.updatedAt)}). Rewriting it replaces that text. Call again with replace: true once the creator has agreed.`,
      { recapChars: recap.length, recapRevision: ep.recapRevision, changedAt: ep.updatedAt },
    );
  }
  return runJob(
    { kind: 'recap', episodeId: ep.id, dramaId: ep.dramaId, target: String(scriptRevision) },
    async ({ jobId, progress, signal }) => {
      const run = await runAgentUntilDone(
        { agentType: 'recap_writer', message: MESSAGE, episodeId: ep.id, dramaId: ep.dramaId, jobId, scriptRevision, signal, ...opts },
        (calls) => calls.some((c) => c.tool === 'save_recap' && c.ok) || recapRefused(jobId),
        'calling save_recap',
      );
      if (recapRefused(jobId)) throw new Error('The script changed while this recap was being written; the new script gets its own recap');
      progress({ steps: run.steps, model: run.model });
    },
  );
}

/**
 * WriteRecapAfterScript: a saved script of a serial drama gets its recap; a standalone drama gets none, and a script
 * saved unchanged keeps its fresh recap. The recap this replaces is stale or missing, so no `replace` is needed.
 */
export function maybeStartRecap(episodeId: number, opts: Opts = {}) {
  const ep = getEpisodeRow(episodeId);
  if (!getDramaRow(ep.dramaId).serial) return null;
  if (ep.recap.trim() && !isRecapStale(ep)) return null;
  return startRecap(ep.id, { ...opts, replace: false });
}
