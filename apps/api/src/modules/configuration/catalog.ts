import { z } from 'zod';
import type { CatalogModel, CatalogPrice, ServiceType } from '@open-drama/contracts';
import { ApiError } from '../../http/errors';
import { offersEndpoint } from '../generation/adapters/modelrunner';

/**
 * ModelCatalog (adr-0013): the ModelRunner endpoints a service of a type can use, with their prices. The catalog is
 * public and keyless. It is queried on every request and nothing is kept, because the terms forbid compiling a copy.
 */
const CATALOG_URL = 'https://api.modelrunner.run/models';
const PAGE_SIZE = 50;
const MAX_PAGES = 5;

/** What narrows the catalog to a type before the adapter's own rule picks the endpoints it drives. */
const QUERY: Record<ServiceType, Record<string, string>> = {
  text: { category: 'text-to-text' },
  image: { search: 'seedream' },
  video: { search: 'seedance' },
};

const decimal = z.coerce.number().nonnegative();
const Entry = z.object({
  ownerName: z.string(),
  alias: z.string(),
  name: z.string(),
  shortDescription: z.string().nullish(),
  pricingMode: z.string().nullish(),
  pricePerOutput: decimal.nullish(),
  pricePerOutputSecond: decimal.nullish(),
  tokenPricing: z.object({ text: z.object({ input: decimal, output: decimal }).nullish() }).nullish(),
  pricingRules: z.object({ rules: z.array(z.object({ rate: decimal })).nullish() }).nullish(),
});
type Entry = z.infer<typeof Entry>;
const Page = z.object({ data: z.array(z.unknown()), totalPages: z.number().int() });

function priceOf(entry: Entry): CatalogPrice | null {
  switch (entry.pricingMode) {
    case 'per_token':
      return entry.tokenPricing?.text ? { unit: 'tokens', ...entry.tokenPricing.text } : null;
    case 'per_output':
      return entry.pricePerOutput != null ? { unit: 'image', amount: entry.pricePerOutput } : null;
    case 'per_output_second': {
      const rates = entry.pricingRules?.rules?.map((r) => r.rate) ?? [];
      if (rates.length === 0 && entry.pricePerOutputSecond != null) rates.push(entry.pricePerOutputSecond);
      return rates.length > 0 ? { unit: 'second', min: Math.min(...rates), max: Math.max(...rates) } : null;
    }
    default:
      return null;
  }
}

async function fetchPage(type: ServiceType, page: number): Promise<z.infer<typeof Page>> {
  const params = new URLSearchParams({ ...QUERY[type], limit: String(PAGE_SIZE), page: String(page) });
  let res: Response;
  try {
    res = await fetch(`${CATALOG_URL}?${params}`, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ApiError('PROVIDER_ERROR', 'The ModelRunner catalog could not be reached');
  }
  if (!res.ok) throw new ApiError('PROVIDER_ERROR', `The ModelRunner catalog answered ${res.status}`);
  const parsed = Page.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw new ApiError('PROVIDER_ERROR', 'The ModelRunner catalog answered in an unexpected shape');
  return parsed.data;
}

export async function browseModelRunnerCatalog(type: ServiceType): Promise<CatalogModel[]> {
  const first = await fetchPage(type, 1);
  const rest = await Promise.all(
    Array.from({ length: Math.min(first.totalPages, MAX_PAGES) - 1 }, (_, i) => fetchPage(type, i + 2)),
  );
  const models: CatalogModel[] = [];
  for (const raw of [first, ...rest].flatMap((p) => p.data)) {
    // Entries that do not parse (a new pricing shape, say) are left out rather than failing the list.
    const entry = Entry.safeParse(raw);
    if (!entry.success) continue;
    const id = `${entry.data.ownerName}/${entry.data.alias}`;
    if (type !== 'text' && !offersEndpoint(type, id)) continue;
    models.push({ id, name: entry.data.name, description: entry.data.shortDescription ?? '', price: priceOf(entry.data) });
  }
  return models.sort((a, b) => a.id.localeCompare(b.id));
}
