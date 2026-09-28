import { and, eq } from 'drizzle-orm';
import type { AspectRatio, AssetKind } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { characters, generationTasks, props, scenes } from '../../../db/schema';
import { nowIso } from '../../../db/schema/columns';
import { env } from '../../../env';
import { conflict, precondition } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { resolveService } from '../../configuration/services';
import { assertImage, deriveRenditions, storeInlineImage, storeRemoteFile } from '../../media/store';
import { imageAdapterFor } from '../adapters/registry';
import {
  ProviderError,
  type GenerateOutcome,
  type ImageAdapter,
  type ProviderRequest,
  type ResultMedia,
  type ServiceConfig,
} from '../adapters/types';
import { classify, messageOf } from './errors';
import { normalizeReferenceImages } from './references';

const REQUEST_TIMEOUT_MS = 10 * 60_000;
/** Image polling profile (adr-0005): every 5 s, at most 120 attempts, within 10 minutes. */
const POLL = { intervalMs: 5000, attempts: 120, maxMs: 10 * 60_000 };

const OWNER_COLUMN = {
  character: generationTasks.characterId,
  scene: generationTasks.sceneId,
  prop: generationTasks.propId,
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
}

/** Sends a provider request and returns its JSON body; non-2xx answers become ProviderError with the provider's message. */
async function send(req: ProviderRequest): Promise<unknown> {
  const res = await fetch(req.url, {
    method: req.method,
    headers: req.headers,
    body: req.body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Non-JSON error pages are reported by status.
  }
  if (!res.ok) {
    const err = (body as { error?: { message?: string; code?: string } | string })?.error;
    const message = typeof err === 'string' ? err : (err?.message ?? (typeof body === 'string' ? body.slice(0, 300) : ''));
    const code = typeof err === 'object' ? err?.code : undefined;
    throw new ProviderError(message || `The provider answered ${res.status}`, res.status, code);
  }
  return body;
}

/** AttachAssetImageOnGeneration: the finished image becomes the asset's reference image. */
function writeBack(kind: AssetKind, id: number, path: string) {
  const table = kind === 'character' ? characters : kind === 'scene' ? scenes : props;
  db.update(table).set({ imagePath: path }).where(eq(table.id, id)).run();
}

async function complete(taskId: number, owner: SubmitImageInput['owner'], media: ResultMedia) {
  const path = media.base64
    ? await storeInlineImage(media.base64.data, media.base64.mimeType)
    : media.url
      ? await storeRemoteFile(media.url, 'image')
      : null;
  if (!path) throw new ProviderError('The provider returned no image');
  await assertImage(path);
  await deriveRenditions(path, 'image');
  db.update(generationTasks)
    .set({ status: 'completed', localPath: path, resultUrl: media.url ?? null, completedAt: nowIso() })
    .where(eq(generationTasks.id, taskId))
    .run();
  writeBack(owner.kind, owner.id, path);
  logger.info({ taskId, owner, path }, 'image task completed');
}

function fail(taskId: number, err: unknown) {
  const errorClass = classify(err);
  const error = messageOf(err);
  db.update(generationTasks)
    .set({ status: 'failed', error, errorClass, completedAt: nowIso() })
    .where(eq(generationTasks.id, taskId))
    .run();
  logger.warn({ taskId, errorClass, error }, 'image task failed');
}

async function poll(adapter: ImageAdapter, config: ServiceConfig, taskId: number, providerTaskId: string): Promise<ResultMedia> {
  if (!adapter.buildPollRequest || !adapter.parsePollResponse) {
    throw new ProviderError('The provider answered asynchronously but its adapter cannot poll');
  }
  const started = Date.now();
  for (let attempt = 0; attempt < POLL.attempts && Date.now() - started < POLL.maxMs; attempt++) {
    await new Promise((r) => setTimeout(r, POLL.intervalMs));
    let result;
    try {
      result = adapter.parsePollResponse(await send(adapter.buildPollRequest(config, providerTaskId)));
    } catch (err) {
      // Transport hiccups are retried; the provider's own failure verdicts come back as status 'failed'.
      if (err instanceof ProviderError && err.status && err.status < 500 && err.status !== 429 && err.status !== 408) throw err;
      logger.debug({ taskId, err: messageOf(err) }, 'poll attempt failed');
      continue;
    }
    if (result.status === 'completed') return result;
    if (result.status === 'failed') throw new ProviderError(result.error);
  }
  throw new ProviderError('Timed out waiting for the provider to finish the image', undefined, 'timeout');
}

async function dispatch(
  taskId: number,
  adapter: ImageAdapter,
  config: ServiceConfig | null,
  input: SubmitImageInput,
): Promise<void> {
  try {
    const referenceImages = await normalizeReferenceImages(input.referenceImages ?? [], adapter.limits.images);
    const record = { taskId, prompt: input.prompt, referenceImages, aspectRatio: input.aspectRatio };
    let outcome: GenerateOutcome;
    if (adapter.generateLocal) outcome = await adapter.generateLocal(record);
    else {
      if (!config || !adapter.buildGenerateRequest || !adapter.parseGenerateResponse) {
        throw new ProviderError(`The ${adapter.provider} image adapter is incomplete`);
      }
      outcome = adapter.parseGenerateResponse(await send(adapter.buildGenerateRequest(config, record)));
    }
    if (outcome.kind === 'async') {
      db.update(generationTasks).set({ providerTaskId: outcome.providerTaskId }).where(eq(generationTasks.id, taskId)).run();
      await complete(taskId, input.owner, await poll(adapter, config!, taskId, outcome.providerTaskId));
    } else {
      await complete(taskId, input.owner, outcome);
    }
  } catch (err) {
    fail(taskId, err);
  }
}

/**
 * SubmitImageGeneration for an asset (adr-0005): resolves the service (explicit → episode lock → active),
 * refuses while the asset already has an image task processing, records the task and dispatches it detached.
 */
export function submitAssetImage(input: SubmitImageInput): number {
  let adapter: ImageAdapter | null;
  let config: ServiceConfig | null = null;
  let serviceId: number | null = null;
  let provider = 'stub';
  let model = 'stub-image';
  if (env.OPEN_DRAMA_STUB_PROVIDERS) {
    adapter = imageAdapterFor('stub');
  } else {
    const resolved = resolveService('image', { explicitId: input.imageServiceId, lockedId: input.lockedServiceId });
    if (!resolved) throw precondition('Add an active image service in Settings before generating images');
    const { row } = resolved;
    adapter = imageAdapterFor(row.provider);
    if (!adapter) throw precondition(`Image generation through ${row.provider} is not available yet`);
    model = input.model || row.models[0] || '';
    if (!model) throw precondition(`The image service ${row.name} lists no model; add one in Settings`);
    if (!row.apiKey) throw precondition(`The image service ${row.name} has no API key`);
    config = { provider: row.provider, baseUrl: row.baseUrl, apiKey: row.apiKey, model };
    serviceId = row.id;
    provider = row.provider;
  }
  if (!adapter) throw precondition('No image adapter is available');

  const column = OWNER_COLUMN[input.owner.kind];
  const taskId = db.transaction((tx) => {
    const running = tx
      .select({ id: generationTasks.id })
      .from(generationTasks)
      .where(and(eq(generationTasks.type, 'image'), eq(column, input.owner.id), eq(generationTasks.status, 'processing')))
      .get();
    if (running) throw conflict('An image is already being generated for this asset', { taskId: running.id });
    return tx
      .insert(generationTasks)
      .values({
        type: 'image',
        dramaId: input.dramaId,
        [input.owner.kind === 'character' ? 'characterId' : input.owner.kind === 'scene' ? 'sceneId' : 'propId']: input.owner.id,
        serviceId,
        provider,
        model,
        prompt: input.prompt,
        params: { aspectRatio: input.aspectRatio, references: (input.referenceImages ?? []).length },
      })
      .returning({ id: generationTasks.id })
      .get().id;
  });
  logger.info({ taskId, provider, model, owner: input.owner }, 'image task submitted');
  void dispatch(taskId, adapter, config, input).catch((err) => logger.error({ taskId, err: messageOf(err) }, 'dispatch crashed'));
  return taskId;
}
