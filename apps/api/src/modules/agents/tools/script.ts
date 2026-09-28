import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/client';
import { episodes } from '../../../db/schema';
import { defineTool } from '../runtime/tool';

export const readEpisodeScript = defineTool({
  id: 'read_episode_script',
  description: "Read the episode's title, raw content and any script already saved.",
  input: z.object({}),
  execute: (_input, ctx) => {
    const ep = db.select().from(episodes).where(eq(episodes.id, ctx.episodeId)).get();
    if (!ep) return { error: 'Episode not found' };
    return { title: ep.title, content: ep.content, currentScript: ep.scriptContent ?? '' };
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
    db.update(episodes).set({ scriptContent: text }).where(eq(episodes.id, ctx.episodeId)).run();
    return { saved: true, characters: text.length };
  },
});
