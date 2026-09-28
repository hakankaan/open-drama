import { and, eq } from 'drizzle-orm';
import type { AspectRatio, AssetKind, RequestAssetImage } from '@open-drama/contracts';
import type { z } from 'zod';
import { db } from '../../db/client';
import { generationTasks } from '../../db/schema';
import { conflict } from '../../http/errors';
import { episodeForAsset, ensureFinalPrompt, loadAssetForPrompt } from '../agents/services/final-prompt';
import { submitAssetImage } from '../generation/engine/images';
import { getDramaRow, touchDrama } from '../production/dramas';

const OWNER = { character: generationTasks.characterId, scene: generationTasks.sceneId, prop: generationTasks.propId } as const;

/** Reference-image shape per kind: turnaround sheets are wide, scenes follow the drama's frame, props are square. */
const shapeFor = (kind: AssetKind, dramaAspect: AspectRatio): AspectRatio =>
  kind === 'character' ? '16:9' : kind === 'scene' ? dramaAspect : '1:1';

/**
 * Request*Image: refuses while an image is already generating for the asset, ensures an up-to-date final prompt
 * (agent, or the local fallback), then submits the image task in the episode's locked image service.
 */
/** Assets with an image request in flight (prompt agent + submit). One process, so an in-memory claim suffices. */
const inFlight = new Set<string>();

export async function requestAssetImage(kind: AssetKind, id: number, body: z.output<typeof RequestAssetImage>) {
  const key = `${kind}:${id}`;
  if (inFlight.has(key)) throw conflict('An image is already being generated for this asset');
  inFlight.add(key);
  try {
    return await requestClaimed(kind, id, body);
  } finally {
    inFlight.delete(key);
  }
}

/** Runs while the asset is claimed, so two requests never both rewrite the prompt. */
async function requestClaimed(kind: AssetKind, id: number, body: z.output<typeof RequestAssetImage>) {
  const asset = loadAssetForPrompt(kind, id);
  const ep = episodeForAsset(asset.dramaId, body.episodeId);
  const running = db
    .select({ id: generationTasks.id })
    .from(generationTasks)
    .where(and(eq(generationTasks.type, 'image'), eq(OWNER[kind], id), eq(generationTasks.status, 'processing')))
    .get();
  if (running) throw conflict('An image is already being generated for this asset', { taskId: running.id });
  const prompt = await ensureFinalPrompt(kind, id, { episodeId: ep.id, model: body.textModel, textServiceId: body.textServiceId });
  const drama = getDramaRow(asset.dramaId);
  const taskId = submitAssetImage({
    owner: { kind, id },
    dramaId: asset.dramaId,
    prompt,
    aspectRatio: shapeFor(kind, drama.aspectRatio),
    model: body.model,
    imageServiceId: body.imageServiceId,
    lockedServiceId: ep.imageServiceId,
  });
  touchDrama(asset.dramaId);
  return { taskId };
}
