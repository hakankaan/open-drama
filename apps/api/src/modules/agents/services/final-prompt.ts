import { and, eq, isNull } from 'drizzle-orm';
import type { AssetKind, TextModelOverride } from '@open-drama/contracts';
import type { z } from 'zod';
import { db } from '../../../db/client';
import { characters, props, scenes } from '../../../db/schema';
import { invalid, notFound } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { withStylePrefix } from '../../assets/extraction';
import { getEpisodeRow } from '../../production/episodes';
import { runAgentUntilSaved } from '../runtime/run-agent';

const FORMAT: Record<AssetKind, string> = {
  character: 'turnaround-sheet',
  scene: 'establishing-shot (nobody in it)',
  prop: 'product-shot',
};

export interface AssetPromptState {
  id: number;
  dramaId: number;
  label: string;
  finalPrompt: string | null;
  finalPromptStale: boolean;
  fields: Record<string, string>;
}

export function loadAssetForPrompt(kind: AssetKind, id: number): AssetPromptState {
  if (kind === 'character') {
    const r = db.select().from(characters).where(and(eq(characters.id, id), isNull(characters.deletedAt))).get();
    if (!r) throw notFound('Character');
    return { id, dramaId: r.dramaId, label: r.name, finalPrompt: r.finalPrompt, finalPromptStale: r.finalPromptStale, fields: { appearance: r.appearance, styling: r.styling, description: r.description } };
  }
  if (kind === 'scene') {
    const r = db.select().from(scenes).where(and(eq(scenes.id, id), isNull(scenes.deletedAt))).get();
    if (!r) throw notFound('Scene');
    const label = r.time ? `${r.location} (${r.time})` : r.location;
    return { id, dramaId: r.dramaId, label, finalPrompt: r.finalPrompt, finalPromptStale: r.finalPromptStale, fields: { place: label, dressing: r.prompt, lighting: r.lighting } };
  }
  const r = db.select().from(props).where(and(eq(props.id, id), isNull(props.deletedAt))).get();
  if (!r) throw notFound('Prop');
  return { id, dramaId: r.dramaId, label: r.name, finalPrompt: r.finalPrompt, finalPromptStale: r.finalPromptStale, fields: { type: r.type, description: r.description } };
}

/** The episode the prompt agent runs in must belong to the asset's drama. */
export function episodeForAsset(dramaId: number, episodeId: number) {
  const ep = getEpisodeRow(episodeId);
  if (ep.dramaId !== dramaId) throw invalid('The episode belongs to another project');
  return ep;
}

/**
 * Generate*FinalPrompt: the prompt generator writes and saves the prompt (style prefix added by the save tool).
 * An up-to-date prompt is returned as is unless `force`.
 */
export async function generateFinalPrompt(
  kind: AssetKind,
  id: number,
  opts: { episodeId: number; force?: boolean } & z.input<typeof TextModelOverride>,
): Promise<string> {
  const asset = loadAssetForPrompt(kind, id);
  episodeForAsset(asset.dramaId, opts.episodeId);
  if (!opts.force && asset.finalPrompt && !asset.finalPromptStale) return asset.finalPrompt;
  await runAgentUntilSaved(
    {
      agentType: 'prompt_generator',
      message: `Write the ${FORMAT[kind]} prompt for the ${kind} "${asset.label}" (id ${id}): read it with read_${kind}s, then save the prompt with save_${kind}_final_prompt.`,
      episodeId: opts.episodeId,
      dramaId: asset.dramaId,
      model: opts.model,
      textServiceId: opts.textServiceId,
      target: { kind, id },
    },
    `save_${kind}_final_prompt`,
  );
  return loadAssetForPrompt(kind, id).finalPrompt ?? '';
}

/** Local prompt from the fields when the agent cannot run (style + fields + format constraints). */
export function fallbackPrompt(kind: AssetKind, asset: AssetPromptState): string {
  const fields = Object.values(asset.fields).filter((v) => v.trim()).join('. ');
  const body =
    kind === 'character'
      ? `Character turnaround sheet of ${asset.label}: head-and-shoulders portrait with full-body front, side and back views at the same scale, neutral pose. ${fields}. Plain light background, even studio lighting, no text.`
      : kind === 'scene'
        ? `Wide establishing view of ${asset.label}, level and steady. ${fields}. No people, no characters, empty scene.`
        : `Product shot of ${asset.label}: ${fields}. Isolated on a plain neutral background, soft even lighting, no hands, no text.`;
  return withStylePrefix(asset.dramaId, body);
}

/** The prompt to generate an image with: the up-to-date final prompt, a fresh one, or the local fallback. */
export async function ensureFinalPrompt(
  kind: AssetKind,
  id: number,
  opts: { episodeId: number } & z.input<typeof TextModelOverride>,
): Promise<string> {
  try {
    const prompt = await generateFinalPrompt(kind, id, opts);
    if (prompt.trim()) return prompt;
  } catch (err) {
    logger.warn({ kind, id, err: (err as Error).message }, 'final prompt agent failed; using the local prompt');
  }
  return fallbackPrompt(kind, loadAssetForPrompt(kind, id));
}

