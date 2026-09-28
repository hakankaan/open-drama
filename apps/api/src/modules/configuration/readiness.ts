import { eq } from 'drizzle-orm';
import { SERVICE_TYPES, type ConfigurationReadiness } from '@open-drama/contracts';
import { db } from '../../db/client';
import { modelServices } from '../../db/schema';

/** ConfigurationReadiness: which service types still lack an active service. */
export function getReadiness(): ConfigurationReadiness {
  const rows = db
    .selectDistinct({ serviceType: modelServices.serviceType })
    .from(modelServices)
    .where(eq(modelServices.isActive, true))
    .all();
  const present = new Set(rows.map((r) => r.serviceType));
  const missingTypes = SERVICE_TYPES.filter((t) => !present.has(t));
  return { missingTypes, ready: missingTypes.length === 0 };
}
