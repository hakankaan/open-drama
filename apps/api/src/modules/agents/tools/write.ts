import { and, asc, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/client';
import { episodes } from '../../../db/schema';
import { getDramaRow } from '../../production/dramas';
import { seriesContext } from '../../production/series';
import { defineTool } from '../runtime/tool';

/**
 * The episode writer's source (adr-0015): the planned episode and what surrounds it. The old script is not returned
 * (the writer replaces it); the next episode's beats are, so the hook lands where the plan put it.
 */
export const readEpisodeForWriting = defineTool({
  id: 'read_episode_for_writing',
  description:
    "Read the episode's number, title, synopsis and beat sheet, whether a script already exists, the target length, a `series` block (the project's premise, its story outline and the earlier episodes' recaps) and, for a serial drama, the next episode's title, synopsis and beats when it has them.",
  input: z.object({}),
  execute: (_input, ctx) => {
    const ep = db.select().from(episodes).where(eq(episodes.id, ctx.episodeId)).get();
    if (!ep) return { error: 'Episode not found' };
    const beats = ep.content.trim();
    if (!beats) return { error: 'The episode has no beat sheet (raw content) yet' };
    const result: Record<string, unknown> = {
      episodeNumber: ep.episodeNumber,
      title: ep.title,
      synopsis: ep.description,
      beats,
      hasScript: !!ep.scriptContent?.trim(),
      targetDurationSeconds: ep.targetDurationSeconds,
      series: seriesContext({ dramaId: ctx.dramaId, beforeEpisodeNumber: ep.episodeNumber }, ctx.log),
    };
    if (getDramaRow(ctx.dramaId).serial) {
      const next = db
        .select({ episodeNumber: episodes.episodeNumber, title: episodes.title, description: episodes.description, content: episodes.content })
        .from(episodes)
        .where(and(eq(episodes.dramaId, ctx.dramaId), isNull(episodes.deletedAt), gt(episodes.episodeNumber, ep.episodeNumber)))
        .orderBy(asc(episodes.episodeNumber))
        .get();
      if (next && (next.content.trim() || next.description.trim())) {
        result.nextEpisode = { episodeNumber: next.episodeNumber, title: next.title, synopsis: next.description, beats: next.content.trim() };
      }
    }
    return result;
  },
});
