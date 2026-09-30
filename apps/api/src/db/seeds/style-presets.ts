import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '../client';
import { dramas, stylePresets } from '../schema';

interface SeedPreset {
  value: string;
  name: string;
  prompt: string;
  description: string;
}

/** Built-in visual styles. The prompt fragment is prepended to every image and video prompt of a drama. */
export const STYLE_PRESET_SEEDS: SeedPreset[] = [
  {
    value: 'cinematic',
    name: 'Cinematic live action',
    prompt:
      'photorealistic live-action cinematography, natural skin texture, anamorphic lens, shallow depth of field, motivated practical lighting, subtle film grain, graded like a modern feature film',
    description: 'Realistic footage that looks shot on a cinema camera.',
  },
  {
    value: 'anime',
    name: 'Anime',
    prompt:
      'modern Japanese anime style, clean line art, cel shading with soft gradients, expressive eyes, vivid but balanced palette, detailed painted backgrounds',
    description: 'TV-anime look with clean lines and cel shading.',
  },
  {
    value: '3d-animation',
    name: '3D animation',
    prompt:
      'stylised 3D animated feature look, soft global illumination, rounded appealing character shapes, subsurface skin scattering, rich materials, gentle rim light',
    description: 'Family-film CGI with soft light and appealing shapes.',
  },
  {
    value: 'watercolor',
    name: 'Watercolour storybook',
    prompt:
      'hand-painted watercolour illustration, visible paper texture, soft bleeding edges, muted pastel palette, gentle diffuse daylight, storybook composition',
    description: 'Soft painted look with paper texture.',
  },
  {
    value: 'comic',
    name: 'Graphic novel',
    prompt:
      'graphic novel illustration, bold ink outlines, flat colour blocks with halftone shading, dramatic high-contrast lighting, dynamic framing',
    description: 'Inked comic-book panels with strong contrast.',
  },
  {
    value: 'ink-wash',
    name: 'Ink wash',
    prompt:
      'East Asian ink wash painting, expressive brush strokes, monochrome ink with sparse muted colour accents, generous negative space, rice paper texture',
    description: 'Brush-and-ink painting with open space.',
  },
  {
    value: 'neon-noir',
    name: 'Neon noir',
    prompt:
      'neon-lit night city look, wet reflective streets, magenta and cyan practical lights, haze and volumetric beams, deep shadows, moody high-contrast grade',
    description: 'Rainy night streets under neon light.',
  },
  {
    value: 'claymation',
    name: 'Clay stop-motion',
    prompt:
      'handmade clay stop-motion look, sculpted plasticine characters with fingerprint texture, miniature practical sets, soft studio lighting, slight frame-to-frame imperfection',
    description: 'Tactile miniature sets and plasticine characters.',
  },
];

/**
 * Idempotent, content-addressed seed (adr-0004): inserts missing built-ins, upgrades a built-in only while its
 * prompt still equals the seed text last written, and retires unedited built-ins that left the seed list
 * (deleted when no live drama uses them, otherwise disabled so those dramas keep working).
 */
export function seedStylePresets(): { inserted: number; upgraded: number; retired: number } {
  let inserted = 0;
  let upgraded = 0;
  let retired = 0;
  db.transaction((tx) => {
    STYLE_PRESET_SEEDS.forEach((seed, index) => {
      const row = tx.select().from(stylePresets).where(eq(stylePresets.value, seed.value)).get();
      if (!row) {
        tx.insert(stylePresets)
          .values({ ...seed, sortOrder: (index + 1) * 10, seedPrompt: seed.prompt })
          .run();
        inserted++;
      } else if (row.seedPrompt !== null && row.prompt === row.seedPrompt && row.prompt !== seed.prompt) {
        tx.update(stylePresets)
          .set({ prompt: seed.prompt, seedPrompt: seed.prompt })
          .where(eq(stylePresets.id, row.id))
          .run();
        upgraded++;
      }
    });

    const seedValues = new Set(STYLE_PRESET_SEEDS.map((s) => s.value));
    const builtIns = tx.select().from(stylePresets).where(isNotNull(stylePresets.seedPrompt)).all();
    for (const row of builtIns) {
      if (seedValues.has(row.value) || row.prompt !== row.seedPrompt) continue;
      const inUse = tx
        .select({ id: dramas.id })
        .from(dramas)
        .where(and(eq(dramas.style, row.value), isNull(dramas.deletedAt)))
        .get();
      if (inUse) tx.update(stylePresets).set({ isActive: false }).where(eq(stylePresets.id, row.id)).run();
      else tx.delete(stylePresets).where(eq(stylePresets.id, row.id)).run();
      retired++;
    }
  });
  return { inserted, upgraded, retired };
}
