import { and, asc, desc, eq, ne } from 'drizzle-orm';
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
import { modelServices } from '../../db/schema';
import { assertSomething, invalid, notFound } from '../../http/errors';

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

export function updateModelService(id: number, input: UpdateModelService): ModelService {
  const current = getServiceRow(id);
  assertSomething(input);
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

/** ApplyQuickSetup: writes one service per type from the template, upserting by name or (type, provider, baseUrl). */
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
      const values = {
        serviceType: svc.serviceType,
        provider: svc.provider,
        name: svc.name,
        baseUrl: svc.baseUrl,
        apiKey: input.apiKey,
        models: svc.models,
        isActive: true,
      };
      const row = existing
        ? tx.update(modelServices).set(values).where(eq(modelServices.id, existing.id)).returning().get()
        : tx.insert(modelServices).values(values).returning().get();
      return toModelService(row);
    }),
  );
}
