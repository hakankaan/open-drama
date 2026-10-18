import { eq } from 'drizzle-orm';
import { GeneratedView, type AspectRatio, type AssetKind, type RequestAssetImage } from '@open-drama/contracts';
import type { z } from 'zod';
import { db } from '../../db/client';
import { characters } from '../../db/schema';
import { conflict, invalid, precondition } from '../../http/errors';
import { episodeForAsset, ensureFinalPrompt, loadAssetForPrompt } from '../agents/services/final-prompt';
import { processingImageTask, submitImage, type SubmitImageInput } from '../generation/engine/images';
import { getDramaRow, touchDrama } from '../production/dramas';
import { withAssetClaim } from './claims';
import { referenceReason, VIEW_SHAPE, viewPrompt } from './views';

/** Reference-image shape of a scene (the drama's frame) or a prop (square); a character's follows its view. */
const shapeFor = (kind: 'scene' | 'prop', dramaAspect: AspectRatio): AspectRatio => (kind === 'scene' ? dramaAspect : '1:1');

/**
 * A character's view request (adr-0018): the views in order, the headshot first. Any other view is drawn from the
 * headshot, so it needs one, existing or made earlier in the same request. The headshot is drawn from the
 * character's sheet while it has no headshot yet, keeping the face of a character made before views; a new headshot
 * of a character that has one starts afresh.
 */
function characterViews(id: number, requested: GeneratedView[] | undefined) {
  const order = GeneratedView.options;
  const views = [...(requested ?? ['headshot', 'body'])].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const row = db.select().from(characters).where(eq(characters.id, id)).get()!;
  if (views[0] !== 'headshot' && !row.headshotPath) throw precondition('Generate the headshot first: the other views are drawn from it');
  const reference = views[0] === 'headshot' ? (row.headshotPath ? null : row.sheetPath) : row.headshotPath;
  return { views: views as [GeneratedView, ...GeneratedView[]], reference };
}

/**
 * Request*Image: refuses while an image is already generating for the asset, ensures an up-to-date final prompt
 * (agent, or the local fallback), then submits the image task: in the episode's locked image service when an
 * episode is given, else in the explicit or the highest-priority active one with no lock claimed, as speech is
 * (adr-0024); for a character, its first view, the others following one by one (adr-0018). The asset is claimed
 * for the whole request, so a bulk save leaves its fields alone meanwhile.
 */
export const requestAssetImage = (kind: AssetKind, id: number, body: z.output<typeof RequestAssetImage>) =>
  withAssetClaim(kind, id, () => requestClaimed(kind, id, body));

/** Runs while the asset is claimed, so two requests never both rewrite the prompt. */
async function requestClaimed(kind: AssetKind, id: number, body: z.output<typeof RequestAssetImage>) {
  if (body.views && kind !== 'character') throw invalid('Only a character has views');
  const asset = loadAssetForPrompt(kind, id);
  const ep = body.episodeId === undefined ? null : episodeForAsset(asset.dramaId, body.episodeId);
  const running = processingImageTask(kind, id);
  if (running) throw conflict('An image is already being generated for this asset', { taskId: running.id });
  const chain = kind === 'character' ? characterViews(id, body.views) : null;
  const prompt = await ensureFinalPrompt(kind, id, { episodeId: ep?.id, model: body.textModel, textServiceId: body.textServiceId });
  const service = {
    model: body.model,
    imageServiceId: body.imageServiceId,
    ...(ep ? { lockedServiceId: ep.imageServiceId, lockFor: ep.id } : {}),
  };
  let input: SubmitImageInput;
  if (chain) {
    const [view, ...rest] = chain.views;
    input = {
      owner: { kind, id },
      dramaId: asset.dramaId,
      prompt: viewPrompt(asset.dramaId, prompt, view),
      aspectRatio: VIEW_SHAPE[view],
      ...(chain.reference ? { referenceImages: [chain.reference], referenceRequired: referenceReason(view) } : {}),
      view,
      ...(rest.length ? { then: { views: rest, finalPrompt: prompt } } : {}),
      ...service,
    };
  } else {
    const shape = shapeFor(kind as 'scene' | 'prop', getDramaRow(asset.dramaId).aspectRatio);
    input = { owner: { kind, id }, dramaId: asset.dramaId, prompt, aspectRatio: shape, ...service };
  }
  // With an episode, its first image generation claims its image lock before the task starts (adr-0016).
  const { taskId } = submitImage(input);
  touchDrama(asset.dramaId);
  return { taskId };
}
