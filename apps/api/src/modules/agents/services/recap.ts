import type { TextModelOverride } from '@open-drama/contracts';
import type { z } from 'zod';
import { precondition } from '../../../http/errors';
import { runJob } from '../../jobs/run-job';
import { getDramaRow } from '../../production/dramas';
import { getEpisodeRow } from '../../production/episodes';
import { runAgentUntilDone } from '../runtime/run-agent';
import { forgetRecap, recapRefused } from '../tools/recap';

type Opts = z.input<typeof TextModelOverride>;

/** Appended to the rewriter's and breaker's messages, so workspaces with older prompt files still get the pointer. */
export const SERIES_NOTE =
  "The tool result has a `series` block: the project's premise and, for a serial drama, the earlier episodes' recaps (ready, stale or missing). Keep the story continuous with it.";

const MESSAGE =
  "Read this episode's script with read_episode_for_recap, write its recap following your skills, then save it with save_recap. The tool result's `series` block gives the project's premise and the earlier episodes' recaps: use them to keep names and references consistent, but recap only this episode.";

/**
 * WriteRecap → RecapJob (adr-0014). Keyed by the script revision it starts from, so a newer revision's job may start
 * while an older one still runs; the older one's save is refused by save_recap and the job fails at once.
 */
export function startRecap(episodeId: number, opts: Opts = {}) {
  const ep = getEpisodeRow(episodeId);
  if (!getDramaRow(ep.dramaId).serial) {
    throw precondition('Recaps are written for projects whose episodes continue one story; turn that on in the project settings');
  }
  if (!ep.scriptContent?.trim()) throw precondition('Finish the script (rewrite or skip) before writing its recap');
  const scriptRevision = ep.scriptRevision;
  return runJob(
    { kind: 'recap', episodeId: ep.id, dramaId: ep.dramaId, target: String(scriptRevision) },
    async ({ jobId, progress }) => {
      try {
        const run = await runAgentUntilDone(
          { agentType: 'recap_writer', message: MESSAGE, episodeId: ep.id, dramaId: ep.dramaId, jobId, scriptRevision, ...opts },
          (calls) => calls.some((c) => c.tool === 'save_recap' && c.ok) || recapRefused(jobId),
          'calling save_recap',
        );
        if (recapRefused(jobId)) throw new Error('The script changed while this recap was being written; the new script gets its own recap');
        progress({ steps: run.steps, model: run.model });
      } finally {
        forgetRecap(jobId);
      }
    },
  );
}

/** WriteRecapAfterScript: a saved script of a serial drama gets its recap; a standalone drama gets none. */
export function maybeStartRecap(episodeId: number, opts: Opts = {}) {
  const ep = getEpisodeRow(episodeId);
  if (!getDramaRow(ep.dramaId).serial) return null;
  return startRecap(ep.id, opts);
}
