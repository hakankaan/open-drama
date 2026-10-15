import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { GeneratedView, type AspectRatio, type AssetKind } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { characters, generationTasks, props, scenes } from '../../../db/schema';
import { logger } from '../../../http/logger';
import { assertImage, deriveRenditions, storeInlineImage, storeRemoteFile } from '../../media/store';
import { imageAdapterFor } from '../adapters/registry';
import { referenceReason, VIEW_COLUMN, VIEW_SHAPE, viewPrompt } from '../../assets/views';
import { ProviderError, type ImageAdapter, type ResultMedia } from '../adapters/types';
import { ConfigError } from './errors';
import { claimTask, completeTask, detach, generate, recordResultUrl, resolveGeneration, type ResolvedGeneration } from './lifecycle';
import { normalizeReferenceImages } from './references';

/** Image polling profile (adr-0005): every 5 s, at most 120 attempts, within 10 minutes. */
export const IMAGE_POLL = { intervalMs: 5000, attempts: 120, maxMs: 10 * 60_000 };

/** Per asset kind: its table, and the task column and insert key that point at it. */
export const ASSET_TASK_OWNER = {
  character: { table: characters, column: generationTasks.characterId, key: 'characterId' },
  scene: { table: scenes, column: generationTasks.sceneId, key: 'sceneId' },
  prop: { table: props, column: generationTasks.propId, key: 'propId' },
} as const;

export interface SubmitImageInput {
  owner: { kind: AssetKind; id: number };
  dramaId: number;
  prompt: string;
  aspectRatio: AspectRatio;
  referenceImages?: string[];
  model?: string;
  imageServiceId?: number;
  /** The episode's locked image service, used when no explicit service is given. */
  lockedServiceId?: number | null;
  /** The episode whose empty image lock this generation claims before it starts (adr-0016). */
  lockFor?: number;
  /** The character view the image becomes (adr-0018); a scene or prop holds one image. */
  view?: GeneratedView;
  /** Views generated after this one, in order, each from the character's headshot (adr-0018). */
  then?: ViewChain;
  /**
   * Why the image must be drawn from its reference: a model that takes no reference image fails the task with this,
   * before anything is paid, instead of drawing someone else.
   */
  referenceRequired?: string;
}

/** The rest of a character's view request, kept on the task so a restart continues it; `finalPrompt` describes the person. */
const ViewChain = z.object({ views: z.array(GeneratedView).min(1), finalPrompt: z.string() });
type ViewChain = z.infer<typeof ViewChain>;

/** The task's asset, or null when the task is not an asset image (set by submitAssetImage, read back on resume). */
export function assetOwnerOf(task: { characterId: number | null; sceneId: number | null; propId: number | null }): SubmitImageInput['owner'] | null {
  if (task.characterId !== null) return { kind: 'character', id: task.characterId };
  if (task.sceneId !== null) return { kind: 'scene', id: task.sceneId };
  if (task.propId !== null) return { kind: 'prop', id: task.propId };
  return null;
}

/** Stores the result and makes it the asset's reference image (AttachAssetImageOnGeneration); a deleted asset is left alone. */
export async function completeImage(taskId: number, owner: SubmitImageInput['owner'], media: ResultMedia, serviceBaseUrl: string | undefined) {
  recordResultUrl(taskId, media.url);
  const path = media.file
    ? media.file
    : media.base64
      ? await storeInlineImage(media.base64.data)
      : media.url
        ? await storeRemoteFile(media.url, 'image', serviceBaseUrl)
        : null;
  if (!path) throw new ProviderError('The provider returned no image');
  await assertImage(path);
  await deriveRenditions(path, 'image');
  const task = db.select().from(generationTasks).where(eq(generationTasks.id, taskId)).get();
  // A character image lands on its view; one requested before views existed was a sheet (adr-0018).
  const view = GeneratedView.safeParse(task?.params.view).data;
  const written = completeTask(taskId, { localPath: path }, (tx) => {
    if (owner.kind === 'character') {
      tx.update(characters)
        .set({ [VIEW_COLUMN[view ?? 'sheet']]: path })
        .where(and(eq(characters.id, owner.id), isNull(characters.deletedAt)))
        .run();
      return;
    }
    const { table } = ASSET_TASK_OWNER[owner.kind];
    tx.update(table).set({ imagePath: path }).where(and(eq(table.id, owner.id), isNull(table.deletedAt))).run();
  });
  logger.info({ taskId, owner, view, path }, 'image task completed');
  // Only the completion that wrote continues the chain, so a view is never requested twice.
  const chain = ViewChain.safeParse(task?.params.then);
  if (written && task && owner.kind === 'character' && chain.success) continueViews(task, owner.id, chain.data);
}

/**
 * Requests the next view of a character's chain (adr-0018) in the service and model the last one used, drawn from
 * the headshot the character has now. A character deleted meanwhile, or a request refused (service gone, another
 * image already running), ends the chain; the views not made stay empty in the studio.
 */
function continueViews(task: typeof generationTasks.$inferSelect, characterId: number, chain: ViewChain) {
  const [view, ...rest] = chain.views as [GeneratedView, ...GeneratedView[]];
  const character = db
    .select({ dramaId: characters.dramaId, headshotPath: characters.headshotPath })
    .from(characters)
    .where(and(eq(characters.id, characterId), isNull(characters.deletedAt)))
    .get();
  if (!character?.headshotPath) {
    logger.info({ taskId: task.id, characterId, view }, 'character view chain ended: no character or headshot');
    return;
  }
  try {
    submitAssetImage({
      owner: { kind: 'character', id: characterId },
      dramaId: character.dramaId,
      prompt: viewPrompt(character.dramaId, chain.finalPrompt, view),
      aspectRatio: VIEW_SHAPE[view],
      referenceImages: [character.headshotPath],
      referenceRequired: referenceReason(view),
      model: task.model || undefined,
      imageServiceId: task.serviceId ?? undefined,
      view,
      ...(rest.length ? { then: { views: rest, finalPrompt: chain.finalPrompt } } : {}),
    });
  } catch (err) {
    logger.warn({ taskId: task.id, characterId, view, err: (err as Error).message }, 'character view chain ended: next view refused');
  }
}

/**
 * Right before the provider is paid, the task re-checks that it is still wanted: false when it no longer runs,
 * throws when its asset was deleted while the references were being prepared.
 */
function stillWanted(taskId: number, owner: SubmitImageInput['owner']): boolean {
  const task = db.select({ status: generationTasks.status }).from(generationTasks).where(eq(generationTasks.id, taskId)).get();
  if (task?.status !== 'processing') return false;
  const { table } = ASSET_TASK_OWNER[owner.kind];
  const asset = db.select({ deletedAt: table.deletedAt }).from(table).where(eq(table.id, owner.id)).get();
  if (!asset || asset.deletedAt) throw new Error(`The ${owner.kind} was deleted before its image was requested; nothing was sent to the provider`);
  return true;
}

async function run(taskId: number, resolved: ResolvedGeneration<ImageAdapter>, input: SubmitImageInput) {
  const { adapter, model } = resolved;
  // The model's own limit when the adapter can read it (none for a model without an edit endpoint).
  const limit = adapter.describeModel ? (await adapter.describeModel(model)).images : adapter.limits.images;
  if (input.referenceRequired && input.referenceImages?.length && limit === 0) throw new ConfigError(input.referenceRequired);
  const referenceImages = await normalizeReferenceImages(input.referenceImages ?? [], limit);
  if (referenceImages.length < new Set(input.referenceImages).size) {
    logger.info({ taskId, model, limit }, 'image references beyond the model limit were left out');
  }
  const record = { taskId, prompt: input.prompt, referenceImages, aspectRatio: input.aspectRatio };
  if (!stillWanted(taskId, input.owner)) return;
  await completeImage(taskId, input.owner, await generate(taskId, resolved, record, IMAGE_POLL, 'image'), resolved.config?.baseUrl);
}

/**
 * SubmitImageGeneration for an asset (adr-0005): resolves the service (explicit → episode lock → active),
 * refuses while the asset already has an image task processing, records the task and dispatches it detached.
 */
export function submitAssetImage(input: SubmitImageInput): { taskId: number; serviceId: number | null } {
  const resolved = resolveGeneration('image', imageAdapterFor, {
    explicitId: input.imageServiceId,
    lockedId: input.lockedServiceId,
    lockFor: input.lockFor,
    model: input.model,
  });
  const owner = ASSET_TASK_OWNER[input.owner.kind];
  const taskId = claimTask(
    {
      type: 'image',
      dramaId: input.dramaId,
      [owner.key]: input.owner.id,
      serviceId: resolved.serviceId,
      provider: resolved.provider,
      model: resolved.model,
      prompt: input.prompt,
      params: {
        aspectRatio: input.aspectRatio,
        references: (input.referenceImages ?? []).length,
        ...(input.view ? { view: input.view } : {}),
        ...(input.then ? { then: input.then } : {}),
      },
    },
    { column: owner.column, id: input.owner.id, busyMessage: 'An image is already being generated for this asset' },
  );
  logger.info({ taskId, provider: resolved.provider, model: resolved.model, owner: input.owner }, 'image task submitted');
  detach(taskId, 'image', () => run(taskId, resolved, input));
  return { taskId, serviceId: resolved.serviceId };
}
