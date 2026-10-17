import { existsSync } from 'node:fs';
import { and, eq, isNull } from 'drizzle-orm';
import type { z } from 'zod';
import type { EpisodeCharacterCard, RequestOutfitImage, TaskStarted, UpdateEpisodeOutfit } from '@open-drama/contracts';
import { db } from '../../db/client';
import { characters, episodeCharacters, generationTasks } from '../../db/schema';
import { assertSomething, conflict, invalid, notFound, precondition } from '../../http/errors';
import { toAbsolute } from '../../lib/paths';
import { outfitTasksOf, submitImage } from '../generation/engine/images';
import { latestTasks } from '../generation/tasks';
import { touchDrama } from '../production/dramas';
import { getEpisodeRow } from '../production/episodes';
import { boundShots, markKeyframesStale } from '../storyboard/staleness';
import { withStylePrefix } from './extraction';
import { episodeCharacterCards } from './service';

/** The framing of an outfit picture: the full-body view's, dressed as the prompt says rather than as the reference. */
const FRAMING =
  'Full-body view from the front: the whole figure from head to feet, standing upright in a neutral pose, arms relaxed. One person, plain light background, even studio lighting, no text. The same person as the reference image, with the same face, hair and build, dressed exactly as described below.';
const REFERENCE_REQUIRED =
  'The outfit is drawn on the character’s headshot, and this image model takes no reference image, so it would draw someone else; pick an image model that edits images.';

/** A live character of the episode's drama, linked to the episode; 404 otherwise. */
function linkOf(characterId: number, episodeId: number) {
  const ep = getEpisodeRow(episodeId);
  const character = db
    .select()
    .from(characters)
    .where(and(eq(characters.id, characterId), eq(characters.dramaId, ep.dramaId), isNull(characters.deletedAt)))
    .get();
  if (!character) throw notFound('Character');
  const link = db
    .select()
    .from(episodeCharacters)
    .where(and(eq(episodeCharacters.episodeId, ep.id), eq(episodeCharacters.characterId, character.id)))
    .get();
  if (!link) throw notFound('The character in this episode');
  return { ep, character, link };
}

function cardOf(characterId: number, episodeId: number): EpisodeCharacterCard {
  const { character, link } = linkOf(characterId, episodeId);
  return episodeCharacterCards(episodeId, [{ row: character, outfit: link.outfit, outfitPath: link.outfitPath }])[0]!;
}

/**
 * SetEpisodeOutfit (adr-0023): what the character wears in the episode, and its full-body picture. A changed outfit
 * clears the picture (it shows the old one) unless the same request gives one; an empty outfit wears the character's
 * own styling and keeps no picture. A picture cannot be given or removed while one is being drawn (409). A changed
 * outfit or picture marks the keyframes of the episode's shots with the character stale (adr-0019).
 */
export function updateEpisodeOutfit(characterId: number, body: z.output<typeof UpdateEpisodeOutfit>): EpisodeCharacterCard {
  const { episodeId, ...patch } = body;
  assertSomething(patch);
  const { ep, link } = linkOf(characterId, episodeId);
  // A drawing picture would land over the one given or removed now; the outfit text may change (the drawing then
  // stops mattering: it lands only on the outfit it was drawn for).
  const drawing = latestTasks('image', generationTasks.characterId, [characterId], outfitTasksOf(ep.id)).get(characterId);
  if (patch.outfitPath !== undefined && drawing?.status === 'processing') {
    throw conflict('The outfit picture cannot change while it is being drawn', { taskId: drawing.id });
  }
  const outfit = patch.outfit ?? link.outfit;
  const changed = outfit !== link.outfit;
  if (patch.outfitPath) {
    if (!outfit) throw precondition('Describe the outfit before adding its picture');
    if (!existsSync(toAbsolute(patch.outfitPath))) throw invalid(`No stored file at ${patch.outfitPath}`);
  }
  const outfitPath = !outfit ? null : patch.outfitPath !== undefined ? patch.outfitPath : changed ? null : link.outfitPath;
  db.transaction((tx) => {
    tx.update(episodeCharacters)
      .set({ outfit, outfitPath })
      .where(and(eq(episodeCharacters.episodeId, ep.id), eq(episodeCharacters.characterId, characterId)))
      .run();
    if (changed || outfitPath !== link.outfitPath) markKeyframesStale(tx, boundShots(tx, { kind: 'character', id: characterId }, ep.id));
  });
  touchDrama(ep.dramaId);
  return cardOf(characterId, ep.id);
}

/**
 * RequestOutfitImage (adr-0023): the character's full body in the episode's outfit, drawn from its headshot in the
 * episode's image service (its lock claimed on first use, adr-0016), with a prompt made here from the character's
 * appearance and the outfit (no agent run). Refused without an outfit or a headshot (412), and while the character
 * has an image generating (409, one image per character at a time). The picture lands on the episode only while the
 * outfit is still the one it was drawn for.
 */
export function requestOutfitImage(characterId: number, body: z.output<typeof RequestOutfitImage>): TaskStarted {
  const { ep, character, link } = linkOf(characterId, body.episodeId);
  if (!link.outfit) throw precondition('Describe the outfit first');
  if (!character.headshotPath) throw precondition('Generate the character’s headshot first: the outfit is drawn on it');
  const appearance = character.appearance.trim();
  const prompt = [FRAMING, appearance && `Appearance: ${appearance}`, `Outfit: ${link.outfit}`].filter(Boolean).join('\n');
  const { taskId } = submitImage({
    owner: { kind: 'character', id: character.id },
    dramaId: ep.dramaId,
    prompt: withStylePrefix(ep.dramaId, prompt),
    aspectRatio: '9:16',
    referenceImages: [character.headshotPath],
    referenceRequired: REFERENCE_REQUIRED,
    model: body.model,
    imageServiceId: body.imageServiceId,
    lockedServiceId: ep.imageServiceId,
    lockFor: ep.id,
    outfit: { episodeId: ep.id, outfit: link.outfit },
  });
  touchDrama(ep.dramaId);
  return { taskId };
}
