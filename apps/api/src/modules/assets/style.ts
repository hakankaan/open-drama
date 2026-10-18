import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { dramas } from '../../db/schema';
import { getDramaStylePrompt } from '../configuration/presets';

const styleOf = (dramaId: number) => {
  const drama = db.select({ style: dramas.style }).from(dramas).where(eq(dramas.id, dramaId)).get();
  return drama ? getDramaStylePrompt(drama.style).trim() : '';
};

/** The drama's style fragment, prepended once (Save*FinalPrompt: the model never writes style words). */
export function withStylePrefix(dramaId: number, prompt: string): string {
  const style = styleOf(dramaId);
  const body = prompt.trim();
  if (!style || body.toLowerCase().startsWith(style.toLowerCase())) return body;
  return `${style}. ${body}`;
}

/** The prompt without the drama's style fragment in front, for text that goes between the two. */
export function withoutStylePrefix(dramaId: number, prompt: string): string {
  const style = styleOf(dramaId);
  const body = prompt.trim();
  return style && body.toLowerCase().startsWith(style.toLowerCase()) ? body.slice(style.length).replace(/^[\s.]+/, '') : body;
}
