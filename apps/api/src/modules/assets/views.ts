import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { CharacterView, type AspectRatio, type CharacterViews, type GeneratedView } from '@open-drama/contracts';
import type { characters } from '../../db/schema';
import { toAbsolute } from '../../lib/paths';
import { storeBuffer } from '../media/store';
import { withoutStylePrefix, withStylePrefix } from './extraction';

type CharacterRow = typeof characters.$inferSelect;

/** The `characters` column that holds each view (adr-0018); the sheet keeps the column every image used before. */
export const VIEW_COLUMN = {
  headshot: 'headshotPath',
  body: 'bodyPath',
  side: 'sidePath',
  back: 'backPath',
  sheet: 'sheetPath',
} as const satisfies Record<CharacterView, keyof CharacterRow>;

export const viewsOf = (row: Pick<CharacterRow, (typeof VIEW_COLUMN)[CharacterView]>): CharacterViews => ({
  headshot: row.headshotPath,
  body: row.bodyPath,
  side: row.sidePath,
  back: row.backPath,
  sheet: row.sheetPath,
});

/** The column values a partial views patch sets. */
export const viewColumns = (views: Partial<CharacterViews> | undefined) =>
  Object.fromEntries(
    CharacterView.options.flatMap((v) => (views?.[v] !== undefined ? [[VIEW_COLUMN[v], views[v]]] : [])),
  ) as Partial<Pick<CharacterRow, (typeof VIEW_COLUMN)[CharacterView]>>;

/**
 * The framing each view's image prompt opens with: the final prompt describes the person, and the code says what
 * picture to take of them. The headshot is the head only, as large as the frame allows; the other views are drawn
 * from it as their reference image.
 */
const FRAMING: Record<GeneratedView, string> = {
  headshot:
    'Close-up portrait of the head only: the face fills most of the frame, looking straight at the camera with a neutral expression. One person, plain light background, even studio lighting, no text.',
  body: 'Full-body view from the front: the whole figure from head to feet, standing upright in a neutral pose, arms relaxed. One person, plain light background, even studio lighting, no text. The same person as the reference image, with the same face, hair and build.',
  side: 'Full-body side view in profile: the whole figure from head to feet, standing upright in a neutral pose. One person, plain light background, even studio lighting, no text. The same person as the reference image, with the same face, hair and build.',
  back: 'Full-body view from behind: the whole figure from head to feet, standing upright in a neutral pose, seen from the back. One person, plain light background, even studio lighting, no text. The same person as the reference image, with the same hair and build.',
};

export const VIEW_SHAPE: Record<GeneratedView, AspectRatio> = { headshot: '1:1', body: '9:16', side: '9:16', back: '9:16' };

/**
 * Why a view's reference must reach the image model: a headshot drawn from the character's sheet keeps its face, any
 * other view is drawn from the headshot. A model that takes no reference image fails the task with this, before
 * anything is paid, instead of drawing someone else.
 */
export const referenceReason = (view: GeneratedView) =>
  view === 'headshot'
    ? "The headshot is drawn from the character's sheet to keep its face, and this image model takes no reference image; pick an image model that edits images, or remove the sheet to draw a new face."
    : 'The view is drawn from the headshot, and this image model takes no reference image, so it would draw someone else; pick an image model that edits images.';

/** The drama's style, the view's framing, then the person as the final prompt describes them. */
export const viewPrompt = (dramaId: number, finalPrompt: string, view: GeneratedView) =>
  withStylePrefix(dramaId, `${FRAMING[view]} ${withoutStylePrefix(dramaId, finalPrompt)}`);

const TILE_HEIGHT = 768;
const GAP = 16;
/** Sheets already composed, by their source images, while the process runs (and while the file exists). */
const composed = new Map<string, string>();

/**
 * A multi-view sheet composed from a character's views, left to right at one height on a light background, for a
 * video model that reads sheets when separate views do not fit (adr-0018). Stored like any image; the video task's
 * parameters name it.
 */
export async function composeSheet(paths: string[]): Promise<string> {
  const key = paths.join('\n');
  const cached = composed.get(key);
  if (cached && existsSync(toAbsolute(cached))) return cached;
  const tiles = await Promise.all(
    paths.map((p) => sharp(toAbsolute(p)).rotate().resize({ height: TILE_HEIGHT }).toBuffer({ resolveWithObject: true })),
  );
  const width = tiles.reduce((sum, t) => sum + t.info.width, 0) + GAP * (tiles.length + 1);
  let left = GAP;
  const layers = tiles.map((t) => {
    const layer = { input: t.data, left, top: GAP };
    left += t.info.width + GAP;
    return layer;
  });
  const jpeg = await sharp({ create: { width, height: TILE_HEIGHT + 2 * GAP, channels: 3, background: '#f2f2f2' } })
    .composite(layers)
    .jpeg({ quality: 85 })
    .toBuffer();
  const path = await storeBuffer('images', '.jpg', jpeg);
  composed.set(key, path);
  return path;
}
