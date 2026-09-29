import { SERVICE_TYPES, type ConfigurationReadiness } from '@open-drama/contracts';
import { db } from '../../db/client';
import { modelServices } from '../../db/schema';
import { usableService } from './services';

/** ConfigurationReadiness: which service types still lack a usable (active, keyed) service. */
export function getReadiness(): ConfigurationReadiness {
  const rows = db.selectDistinct({ serviceType: modelServices.serviceType }).from(modelServices).where(usableService()).all();
  const present = new Set(rows.map((r) => r.serviceType));
  const missingTypes = SERVICE_TYPES.filter((t) => !present.has(t));
  return { missingTypes, ready: missingTypes.length === 0 };
}
