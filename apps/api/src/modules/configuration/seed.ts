import { and, eq, max, ne, or } from 'drizzle-orm';
import { QUICK_SETUP_TEMPLATES, type ServiceType } from '@open-drama/contracts';
import { db } from '../../db/client';
import { modelServices } from '../../db/schema';
import { env } from '../../env';
import { logger } from '../../http/logger';
import { rememberSecret } from '../../lib/secrets';
import { usableService } from './services';

/** The gateway a single environment variable seeds at boot, named by get_status for an API-only creator. */
export const ENVIRONMENT_KEYS: Record<string, string> = { modelrunner: 'OPEN_DRAMA_MODELRUNNER_API_KEY' };

export interface EnvironmentSeed {
  inserted: ServiceType[];
  skipped: { type: ServiceType; reason: string }[];
}

/**
 * OPEN_DRAMA_MODELRUNNER_API_KEY (adr-0013, adr-0016): for each service type without a usable service, the ModelRunner
 * template row of that type is inserted with the key, unless a row with the template's name or address already exists;
 * that one is left alone (a creator deactivated it or emptied its key on purpose) and the type is reported unready.
 * Insert-only: nothing a creator changed is ever overwritten, and a deleted seed comes back only while the variable is
 * set. Null when the variable is unset.
 */
export function seedFromEnvironment(): EnvironmentSeed | null {
  const apiKey = env.OPEN_DRAMA_MODELRUNNER_API_KEY;
  if (!apiKey) return null;
  rememberSecret(apiKey);
  const template = QUICK_SETUP_TEMPLATES.find((t) => t.gateway === 'modelrunner');
  if (!template) return null;
  const result: EnvironmentSeed = { inserted: [], skipped: [] };
  for (const svc of template.services) {
    if (db.select({ id: modelServices.id }).from(modelServices).where(usableService(svc.serviceType)).get()) continue;
    const existing = db
      .select({ id: modelServices.id, isActive: modelServices.isActive, apiKey: modelServices.apiKey, name: modelServices.name })
      .from(modelServices)
      .where(
        or(
          eq(modelServices.name, svc.name),
          and(eq(modelServices.serviceType, svc.serviceType), eq(modelServices.provider, svc.provider), eq(modelServices.baseUrl, svc.baseUrl)),
        ),
      )
      .get();
    if (existing) {
      const reason = !existing.isActive
        ? `${existing.name} is disabled; enable it or delete it to seed again`
        : `${existing.name} has no key; add one in the studio or delete it to seed again`;
      result.skipped.push({ type: svc.serviceType, reason });
      logger.warn({ type: svc.serviceType, serviceId: existing.id }, `environment key not applied: ${reason}`);
      continue;
    }
    const top = db.select({ top: max(modelServices.priority) }).from(modelServices).where(and(eq(modelServices.serviceType, svc.serviceType), ne(modelServices.apiKey, ''))).get()?.top;
    db.insert(modelServices)
      .values({
        serviceType: svc.serviceType,
        provider: svc.provider,
        name: svc.name,
        baseUrl: svc.baseUrl,
        apiKey,
        models: svc.models,
        isActive: true,
        priority: top == null ? 0 : Math.min(1000, top + 1),
      })
      .run();
    result.inserted.push(svc.serviceType);
  }
  return result;
}
