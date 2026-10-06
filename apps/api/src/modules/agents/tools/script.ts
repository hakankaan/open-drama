import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/client';
import { episodes } from '../../../db/schema';
import { writeScript } from '../../production/episodes';
import { seriesContext } from '../../production/series';
import { defineTool } from '../runtime/tool';

export const readEpisodeScript = defineTool({
  id: 'read_episode_script',
  description:
    "Read the episode's title, raw content and any script already saved, with a `series` block: the project's premise and, for a serial drama, the earlier episodes' recaps (ready, stale or missing).",
  input: z.object({}),
  execute: (_input, ctx) => {
    const ep = db.select().from(episodes).where(eq(episodes.id, ctx.episodeId)).get();
    if (!ep) return { error: 'Episode not found' };
    return {
      title: ep.title,
      episodeNumber: ep.episodeNumber,
      series: seriesContext(ctx.dramaId, ctx.episodeId, ctx.log),
      content: ep.content,
      currentScript: ep.scriptContent ?? '',
    };
  },
});

/** SaveScript: the formatted script replaces the episode's scriptContent. */
export const saveScript = defineTool({
  id: 'save_script',
  description: 'Save the complete formatted script of the episode. Call once with the whole script.',
  input: z.object({ content: z.string().min(1).describe('The complete formatted script') }),
  execute: ({ content }, ctx) => {
    const text = content.trim();
    if (text.length < 20) return { error: 'The script is too short; send the complete script.' };
    writeScript(ctx.episodeId, text);
    return { saved: true, characters: text.length };
  },
});
