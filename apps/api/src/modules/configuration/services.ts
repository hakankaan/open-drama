import { and, asc, count, desc, eq, max, ne } from 'drizzle-orm';
import type { z } from 'zod';
import {
  type AddModelService as AddModelServiceSchema,
  DEFERRED_PROVIDERS,
  PROVIDERS_BY_TYPE,
  QUICK_SETUP_TEMPLATES,
  type ApplyQuickSetup,
  type ModelService,
  type ProviderName,
  type ServiceSettings,
  type ServiceType,
  type UpdateModelService,
} from '@open-drama/contracts';
import { db } from '../../db/client';
import { generationTasks, modelServices } from '../../db/schema';
import { assertSomething, conflict, invalid, notFound } from '../../http/errors';

type Row = typeof modelServices.$inferSelect;

/** The API shape: the key is write-only, so only its presence is reported. */
export const toModelService = ({ apiKey, ...row }: Row): ModelService => ({ ...row, hasKey: apiKey.length > 0 });

const ORDER = [desc(modelServices.priority), asc(modelServices.id)] as const;

/** A service a run can fall back to: active and holding a key. Readiness counts exactly these. */
export const usableService = (type?: ServiceType) =>
  and(type ? eq(modelServices.serviceType, type) : undefined, eq(modelServices.isActive, true), ne(modelServices.apiKey, ''));

/** Provider must be one the app supports for the type, and its adapter must exist (adr-0013). */
function assertProvider(serviceType: ServiceType, provider: ProviderName) {
  if (!PROVIDERS_BY_TYPE[serviceType].includes(provider)) {
    throw invalid(`Provider ${provider} does not offer ${serviceType} services`);
  }
  if (DEFERRED_PROVIDERS.includes(provider)) {
    throw invalid(`The ${provider} adapter arrives in iteration 2; it cannot be configured yet`);
  }
}

/** Temperature is only meaningful for text services; it is dropped for the others. */
const normaliseSettings = (serviceType: ServiceType, settings: ServiceSettings): ServiceSettings =>
  serviceType === 'text' && settings.temperature != null ? { temperature: settings.temperature } : {};

const dedupe = (models: string[]) => [...new Set(models.map((m) => m.trim()).filter(Boolean))];

export function listModelServices(filter: { type?: ServiceType; activeOnly?: boolean }): ModelService[] {
  const where = and(
    filter.type ? eq(modelServices.serviceType, filter.type) : undefined,
    filter.activeOnly ? eq(modelServices.isActive, true) : undefined,
  );
  return db
    .select()
    .from(modelServices)
    .where(where)
    .orderBy(...ORDER)
    .all()
    .map(toModelService);
}

export function getServiceRow(id: number): Row {
  const row = db.select().from(modelServices).where(eq(modelServices.id, id)).get();
  if (!row) throw notFound('Model service');
  return row;
}

export function addModelService(input: z.output<typeof AddModelServiceSchema>): ModelService {
  assertProvider(input.serviceType, input.provider);
  const row = db
    .insert(modelServices)
    .values({
      serviceType: input.serviceType,
      provider: input.provider,
      name: input.name,
      baseUrl: input.baseUrl.replace(/\/+$/, ''),
      apiKey: input.apiKey ?? '',
      models: dedupe(input.models),
      priority: input.priority,
      isActive: input.isActive,
      settings: normaliseSettings(input.serviceType, input.settings),
    })
    .returning()
    .get();
  return toModelService(row);
}

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/+$/, '');
  }
};

/**
 * The stored key goes only where it was entered for: moving a keyed service to another address or provider needs the
 * key again, so an edited base URL can never send the saved key to a different host (an update or a test probe).
 */
export function assertKeyFollows(saved: Row, change: { provider?: string; baseUrl?: string; apiKey?: string }) {
  if (change.apiKey || !saved.apiKey) return;
  const moved =
    (change.baseUrl !== undefined && originOf(change.baseUrl) !== originOf(saved.baseUrl)) ||
    (change.provider !== undefined && change.provider !== saved.provider);
  if (moved) throw invalid('Enter the API key again to use it with the new address or provider');
}

/**
 * A generation the provider has accepted is polled with its service's address and key, and a restart resumes it
 * with what the service holds then (adr-0005), so neither changes, nor does the service go, while one is running.
 */
function assertNoRunningTasks(id: number, action: string) {
  const running = db
    .select({ n: count() })
    .from(generationTasks)
    .where(and(eq(generationTasks.serviceId, id), eq(generationTasks.status, 'processing')))
    .get()?.n ?? 0;
  if (running > 0) {
    throw conflict(
      running === 1
        ? `A generation is still running on this service; ${action} once it has finished`
        : `${running} generations are still running on this service; ${action} once they have finished`,
    );
  }
}

export function updateModelService(id: number, input: UpdateModelService): ModelService {
  const current = getServiceRow(id);
  assertSomething(input);
  assertKeyFollows(current, input);
  const rerouted =
    (input.provider !== undefined && input.provider !== current.provider) ||
    (input.baseUrl !== undefined && input.baseUrl.replace(/\/+$/, '') !== current.baseUrl) ||
    (!!input.apiKey && input.apiKey !== current.apiKey);
  if (rerouted) assertNoRunningTasks(id, 'change its provider, address or key');
  const provider = input.provider ?? current.provider;
  if (input.provider) assertProvider(current.serviceType, provider);
  const row = db
    .update(modelServices)
    .set({
      provider,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.baseUrl !== undefined && { baseUrl: input.baseUrl.replace(/\/+$/, '') }),
      // An empty or missing key keeps the stored one (write-only field).
      ...(input.apiKey ? { apiKey: input.apiKey } : {}),
      ...(input.models !== undefined && { models: dedupe(input.models) }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.settings !== undefined && { settings: normaliseSettings(current.serviceType, input.settings) }),
    })
    .where(eq(modelServices.id, id))
    .returning()
    .get();
  return toModelService(row);
}

/** Hard delete. Episodes that locked it fall back to the active service of the type (resolveService). */
export function deleteModelService(id: number): { id: number } {
  getServiceRow(id);
  assertNoRunningTasks(id, 'delete it');
  db.delete(modelServices).where(eq(modelServices.id, id)).run();
  return { id };
}

/**
 * The service to use for a type: an explicit id, else the episode's lock while it is still active, else the
 * highest-priority usable (active, keyed) service. null when the type has none.
 */
export function resolveService(type: ServiceType, opts: { explicitId?: number | null; lockedId?: number | null } = {}) {
  if (opts.explicitId) {
    const row = getServiceRow(opts.explicitId);
    if (row.serviceType !== type) throw invalid(`Service ${row.id} is not a ${type} service`);
    if (!row.isActive) throw invalid(`Service ${row.name} is disabled`);
    return { row, locked: true };
  }
  if (opts.lockedId) {
    const row = db.select().from(modelServices).where(eq(modelServices.id, opts.lockedId)).get();
    if (row && row.isActive && row.serviceType === type) return { row, locked: true };
  }
  const row = db
    .select()
    .from(modelServices)
    .where(usableService(type))
    .orderBy(...ORDER)
    .get();
  return row ? { row, locked: false } : null;
}

/**
 * ApplyQuickSetup: writes one service per type from the template, upserting by name or (type, provider, baseUrl).
 * Each written service outranks the other services of its type, so the platform just set up is the one runs use.
 */
export function applyQuickSetup(input: ApplyQuickSetup): ModelService[] {
  const template = QUICK_SETUP_TEMPLATES.find((t) => t.gateway === input.gateway);
  if (!template) throw invalid(`Unknown quick-setup gateway: ${input.gateway}`);
  return db.transaction((tx) =>
    template.services.map((svc) => {
      const existing =
        tx.select().from(modelServices).where(eq(modelServices.name, svc.name)).get() ??
        tx
          .select()
          .from(modelServices)
          .where(
            and(
              eq(modelServices.serviceType, svc.serviceType),
              eq(modelServices.provider, svc.provider),
              eq(modelServices.baseUrl, svc.baseUrl),
            ),
          )
          .get();
      const others = tx
        .select({ top: max(modelServices.priority) })
        .from(modelServices)
        .where(and(eq(modelServices.serviceType, svc.serviceType), existing ? ne(modelServices.id, existing.id) : undefined))
        .get()?.top;
      const values = {
        serviceType: svc.serviceType,
        provider: svc.provider,
        name: svc.name,
        baseUrl: svc.baseUrl,
        apiKey: input.apiKey,
        models: svc.models,
        isActive: true,
        // Capped at the edit form's bound so the service stays editable.
        priority: others == null ? (existing?.priority ?? 0) : Math.min(1000, Math.max(existing?.priority ?? 0, others + 1)),
      };
      const row = existing
        ? tx.update(modelServices).set(values).where(eq(modelServices.id, existing.id)).returning().get()
        : tx.insert(modelServices).values(values).returning().get();
      return toModelService(row);
    }),
  );
}
