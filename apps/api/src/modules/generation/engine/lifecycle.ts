import { and, eq } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import type { ServiceType } from '@open-drama/contracts';
import { db } from '../../../db/client';
import { generationTasks } from '../../../db/schema';
import { nowIso } from '../../../db/schema/columns';
import { env } from '../../../env';
import { conflict, precondition } from '../../../http/errors';
import { logger } from '../../../http/logger';
import { resolveService } from '../../configuration/services';
import { ProviderError, type Dialect, type ProviderRequest, type ResultMedia, type ServiceConfig } from '../adapters/types';
import { classify, messageOf } from './errors';

// The shared generation lifecycle (adr-0005): service resolution, task claim, dispatch, polling and failure.
// images.ts and videos.ts add what differs per type (records, persistence, write-back).

const REQUEST_TIMEOUT_MS = 10 * 60_000;

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface PollProfile {
  intervalMs: number;
  attempts: number;
  maxMs: number;
}

export interface ResolvedGeneration<A> {
  adapter: A;
  /** null for offline adapters. */
  config: ServiceConfig | null;
  serviceId: number | null;
  provider: string;
  model: string;
}

/**
 * The adapter and credentials for a task: explicit service → the episode's lock → the highest-priority active one.
 * With OPEN_DRAMA_STUB_PROVIDERS=1 the offline adapter serves every request.
 */
export function resolveGeneration<A>(
  type: Exclude<ServiceType, 'text'>,
  adapterFor: (provider: string) => A | null,
  opts: { explicitId?: number; lockedId?: number | null; model?: string },
): ResolvedGeneration<A> {
  if (env.OPEN_DRAMA_STUB_PROVIDERS) {
    const adapter = adapterFor('stub');
    if (!adapter) throw precondition(`No offline ${type} adapter is available`);
    return { adapter, config: null, serviceId: null, provider: 'stub', model: `stub-${type}` };
  }
  const resolved = resolveService(type, { explicitId: opts.explicitId, lockedId: opts.lockedId });
  if (!resolved) throw precondition(`Add an active ${type} service in Settings before generating ${type}s`);
  const { row } = resolved;
  const adapter = adapterFor(row.provider);
  if (!adapter) throw precondition(`${type === 'image' ? 'Image' : 'Video'} generation through ${row.provider} is not available yet`);
  const model = opts.model || row.models[0] || '';
  if (!model) throw precondition(`The ${type} service ${row.name} lists no model; add one in Settings`);
  if (!row.apiKey) throw precondition(`The ${type} service ${row.name} has no API key`);
  return {
    adapter,
    config: { provider: row.provider, baseUrl: row.baseUrl, apiKey: row.apiKey, model },
    serviceId: row.id,
    provider: row.provider,
    model,
  };
}

/**
 * Inserts a task row unless the owner already has a task of the type processing (409). The check and the insert
 * share one transaction.
 */
export function claimTask(
  values: typeof generationTasks.$inferInsert & { type: 'image' | 'video' },
  owner: { column: SQLiteColumn; id: number; busyMessage: string },
): number {
  return db.transaction((tx) => {
    const running = tx
      .select({ id: generationTasks.id })
      .from(generationTasks)
      .where(and(eq(generationTasks.type, values.type), eq(owner.column, owner.id), eq(generationTasks.status, 'processing')))
      .get();
    if (running) throw conflict(owner.busyMessage, { taskId: running.id });
    return tx.insert(generationTasks).values(values).returning({ id: generationTasks.id }).get().id;
  });
}

/** Sends a provider request and returns its JSON body; non-2xx answers become ProviderError with the provider's message. */
export async function send(req: ProviderRequest): Promise<unknown> {
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
    // Providers put the reason in { error: string | { message, code } } or at the top level ({ message, code }).
    const b = (typeof body === 'object' && body ? body : {}) as { error?: { message?: string; code?: string } | string; message?: string; code?: string };
    const err = b.error;
    const message = typeof err === 'string' ? err : (err?.message ?? b.message ?? (typeof body === 'string' ? body.slice(0, 300) : ''));
    const code = typeof err === 'object' ? err.code : b.code;
    throw new ProviderError(message || `The provider answered ${res.status}`, res.status, code);
  }
  return body;
}

async function poll<R>(
  adapter: Dialect<R>,
  config: ServiceConfig,
  taskId: number,
  providerTaskId: string,
  profile: PollProfile,
  what: string,
): Promise<ResultMedia> {
  if (!adapter.buildPollRequest || !adapter.parsePollResponse) {
    throw new ProviderError('The provider answered asynchronously but its adapter cannot poll');
  }
  const started = Date.now();
  for (let attempt = 0; attempt < profile.attempts && Date.now() - started < profile.maxMs; attempt++) {
    await new Promise((r) => setTimeout(r, profile.intervalMs));
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
    if (result.status === 'failed') throw new ProviderError(result.error, undefined, result.code);
  }
  throw new ProviderError(`Timed out waiting for the provider to finish the ${what}`, undefined, 'timeout');
}

/**
 * DispatchGenerationTask + PollGenerationTask: runs the adapter (offline, or request → sync result or provider task
 * id → polling) and returns the provider's result.
 */
export async function generate<R>(
  taskId: number,
  resolved: ResolvedGeneration<Dialect<R>>,
  record: R,
  profile: PollProfile,
  what: string,
): Promise<ResultMedia> {
  const { adapter, config } = resolved;
  if (adapter.generateLocal) {
    const outcome = await adapter.generateLocal(record);
    if (outcome.kind === 'async') throw new ProviderError('Offline adapters answer synchronously');
    return outcome;
  }
  if (!config || !adapter.buildGenerateRequest || !adapter.parseGenerateResponse) {
    throw new ProviderError(`The ${adapter.provider} ${what} adapter is incomplete`);
  }
  const outcome = adapter.parseGenerateResponse(await send(adapter.buildGenerateRequest(config, record)));
  if (outcome.kind === 'result') return outcome;
  db.update(generationTasks).set({ providerTaskId: outcome.providerTaskId }).where(eq(generationTasks.id, taskId)).run();
  logger.info({ taskId, providerTaskId: outcome.providerTaskId }, `${what} task dispatched`);
  return poll(adapter, config, taskId, outcome.providerTaskId, profile, what);
}

/**
 * FailGenerationTask: the message and TaskErrorClass are stored; the owner row is left unchanged. Only a task still
 * processing can fail, so a completed task never flips back (the status only moves forward).
 */
export function failTask(taskId: number, err: unknown, what: string) {
  const errorClass = classify(err);
  const error = messageOf(err);
  db.update(generationTasks)
    .set({ status: 'failed', error, errorClass, completedAt: nowIso() })
    .where(and(eq(generationTasks.id, taskId), eq(generationTasks.status, 'processing')))
    .run();
  logger.warn({ taskId, errorClass, error }, `${what} task failed`);
}

/** Runs a task's work detached: every failure lands on the task row, nothing escapes as an unhandled rejection. */
export function detach(taskId: number, what: string, work: () => Promise<void>) {
  void work()
    .catch((err) => failTask(taskId, err, what))
    .catch((err) => logger.error({ taskId, err: messageOf(err) }, 'dispatch crashed'));
}
