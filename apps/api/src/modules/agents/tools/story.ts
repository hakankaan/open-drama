import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { OUTLINE_MAX_CHARS } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { dramas } from '../../../db/schema';
import { getDramaRow } from '../../production/dramas';
import { episodeStates, type EpisodeState } from '../../production/episodes';
import { fitRecaps } from '../../production/series';
import { defineDramaTool } from '../runtime/tool';

/** Below this an outline is a note, not a story; the creator's own edits are not held to it. */
export const OUTLINE_MIN_CHARS = 200;

interface StoryEpisode {
  episodeNumber: number;
  title: string;
  state: EpisodeState['state'];
  synopsis: string;
  /** Written episodes: whether the recap matches the script; the text itself unless missing or dropped for size. */
  recapStatus?: EpisodeState['recapStatus'];
  recap?: string;
}

/**
 * The story writer's source (adr-0015): the premise, the outline so far as draft notes, and what the episodes already
 * hold. Written episodes come with their recap text, since the outline has to lead through what they say happened;
 * the oldest recaps are left out beyond the series budget and named in `omittedRecaps`.
 */
export const readStory = defineDramaTool({
  id: 'read_story',
  description:
    "Read the project's premise (title, synopsis, genre, tags, whether the episodes continue one story), the current outline as draft notes, and every episode with its state: written (with its recap and whether it is ready or stale, or missing), planned (with its synopsis) or empty. omittedRecaps names the written episodes whose recap text was left out for size.",
  input: z.object({}),
  execute: (_input, ctx) => {
    const drama = getDramaRow(ctx.dramaId);
    const premise = {
      title: drama.title,
      synopsis: drama.description,
      genre: drama.genre,
      tags: drama.tags,
      serial: drama.serial,
      currentOutline: drama.outline,
    };
    const episodes = episodeStates(ctx.dramaId).map((e): StoryEpisode => {
      const entry: StoryEpisode = { episodeNumber: e.episodeNumber, title: e.title, state: e.state, synopsis: e.synopsis };
      if (e.state === 'written') {
        entry.recapStatus = e.recapStatus;
        if (e.recap) entry.recap = e.recap;
      }
      return entry;
    });
    const omittedRecaps = fitRecaps(episodes, premise);
    return { ...premise, episodes, ...(omittedRecaps.length > 0 ? { omittedRecaps } : {}) };
  },
});

/** SaveOutline: the outline is replaced only here, so a failed run keeps the old one. */
export const saveOutline = defineDramaTool({
  id: 'save_outline',
  description: `Save the story outline, ${OUTLINE_MIN_CHARS} to ${OUTLINE_MAX_CHARS} characters of Markdown. Call once with the complete outline.`,
  input: z.object({ outline: z.string().min(1).describe('The complete outline') }),
  execute: ({ outline }, ctx) => {
    const text = outline.trim();
    if (text.length < OUTLINE_MIN_CHARS) return { error: 'The outline is too short; send the complete outline.' };
    if (text.length > OUTLINE_MAX_CHARS) {
      return { error: `The outline is ${text.length} characters; shorten it to at most ${OUTLINE_MAX_CHARS} and save again.` };
    }
    getDramaRow(ctx.dramaId);
    db.update(dramas).set({ outline: text, updatedAt: new Date().toISOString() }).where(eq(dramas.id, ctx.dramaId)).run();
    return { saved: true, characters: text.length };
  },
});
