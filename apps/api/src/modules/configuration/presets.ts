import { and, asc, count, eq, isNull, max } from 'drizzle-orm';
import type { z } from 'zod';
import type {
  CreateStylePreset,
  StylePreset,
  UpdateStylePreset,
} from '@open-drama/contracts';
import { db } from '../../db/client';
import { dramas, stylePresets } from '../../db/schema';
import { assertSomething, conflict, notFound } from '../../http/errors';

type Row = typeof stylePresets.$inferSelect;

const toPreset = ({ seedPrompt, ...row }: Row): StylePreset => ({ ...row, isBuiltIn: seedPrompt !== null });

/** StylePresetCatalog: active presets for project creation, all of them for settings. */
export function listStylePresets(all: boolean): StylePreset[] {
  return db
    .select()
    .from(stylePresets)
    .where(all ? undefined : eq(stylePresets.isActive, true))
    .orderBy(asc(stylePresets.sortOrder), asc(stylePresets.id))
    .all()
    .map(toPreset);
}

export function getPresetByValue(value: string): Row | undefined {
  return db.select().from(stylePresets).where(eq(stylePresets.value, value)).get();
}

export function createStylePreset(input: z.output<typeof CreateStylePreset>): StylePreset {
  if (getPresetByValue(input.value)) throw conflict(`A style with the key "${input.value}" already exists`);
  const last = db.select({ max: max(stylePresets.sortOrder) }).from(stylePresets).get()?.max ?? 0;
  const row = db
    .insert(stylePresets)
    .values({ ...input, sortOrder: input.sortOrder ?? last + 10 })
    .returning()
    .get();
  return toPreset(row);
}

export function updateStylePreset(id: number, input: z.output<typeof UpdateStylePreset>): StylePreset {
  if (!db.select({ id: stylePresets.id }).from(stylePresets).where(eq(stylePresets.id, id)).get()) {
    throw notFound('Style preset');
  }
  assertSomething(input);
  const row = db.update(stylePresets).set(input).where(eq(stylePresets.id, id)).returning().get();
  if (!row) throw notFound('Style preset');
  return toPreset(row);
}

/** A preset used by a live drama cannot be deleted (its prompt fragment is still prepended); disable it instead. */
export function deleteStylePreset(id: number): { id: number } {
  const row = db.select().from(stylePresets).where(eq(stylePresets.id, id)).get();
  if (!row) throw notFound('Style preset');
  const used =
    db
      .select({ n: count() })
      .from(dramas)
      .where(and(eq(dramas.style, row.value), isNull(dramas.deletedAt)))
      .get()?.n ?? 0;
  if (used > 0) {
    throw conflict(`This style is used by ${used} project${used === 1 ? '' : 's'}. Disable it instead.`, { used });
  }
  db.delete(stylePresets).where(eq(stylePresets.id, id)).run();
  return { id };
}

/** The prompt fragment prepended to every image and video prompt of the drama ('' when it has none). */
export function getDramaStylePrompt(style: string): string {
  return getPresetByValue(style)?.prompt ?? '';
}
