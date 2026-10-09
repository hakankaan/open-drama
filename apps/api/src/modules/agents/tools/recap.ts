import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { RECAP_MAX_CHARS } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { episodes } from '../../../db/schema';
import { jobState } from '../../jobs/run-job';
import { writeRecap } from '../../production/episodes';
import { seriesContext } from '../../production/series';
import { defineTool } from '../runtime/tool';

const RECAP_MIN_CHARS = 20;

export const readEpisodeForRecap = defineTool({
  id: 'read_episode_for_recap',
  description:
    "Read the episode's number, title and script, with a `series` block: the project's premise and the earlier episodes' recaps. They are context for names and references only; the recap covers this episode alone.",
  input: z.object({}),
  execute: (_input, ctx) => {
    const ep = db.select().from(episodes).where(eq(episodes.id, ctx.episodeId)).get();
    if (!ep) return { error: 'Episode not found' };
    const script = ep.scriptContent?.trim();
    if (!script) return { error: 'The episode has no script yet' };
    return { episodeNumber: ep.episodeNumber, title: ep.title, series: seriesContext({ dramaId: ctx.dramaId, beforeEpisodeNumber: ep.episodeNumber }, ctx.log), script };
  },
});

/** Recap jobs whose save was refused because the script moved on; the job fails at once instead of retrying. */
const refused = jobState<true>();
export const recapRefused = (jobId: number) => refused.has(jobId);

/** SaveRecap: pinned to the script revision the job started from (adr-0014). */
export const saveRecap = defineTool({
  id: 'save_recap',
  description: `Save the recap of this episode, ${RECAP_MIN_CHARS} to ${RECAP_MAX_CHARS} characters of plain prose. Call once with the complete text.`,
  input: z.object({ recap: z.string().min(1).describe('The complete recap') }),
  execute: ({ recap }, ctx) => {
    const text = recap.trim();
    if (text.length < RECAP_MIN_CHARS) return { error: 'The recap is too short; send the complete recap.' };
    if (text.length > RECAP_MAX_CHARS) {
      return { error: `The recap is ${text.length} characters; shorten it to at most ${RECAP_MAX_CHARS} and save again.` };
    }
    // Outside a recap job there is no revision to pin to, so a save could claim a script it was not written for.
    if (ctx.scriptRevision === undefined || ctx.jobId === undefined) return { error: 'save_recap only runs inside a recap job' };
    if (!writeRecap(ctx.episodeId, text, ctx.scriptRevision)) {
      refused.set(ctx.jobId, true);
      return { error: 'The script changed while this recap was being written; this run is abandoned' };
    }
    return { saved: true, characters: text.length };
  },
});
