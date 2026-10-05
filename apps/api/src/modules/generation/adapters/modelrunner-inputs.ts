import { ProviderError } from './types';

/**
 * What one ModelRunner endpoint takes, read from its public input schema (adr-0013 amendment 5). Only the endpoints a
 * service uses are read, when they are used, and the result lives in memory for an hour: nothing is stored, because
 * the terms forbid compiling the catalog (§6(e)(xiv)).
 */
const SCHEMA_URL = (endpoint: string) => `https://api.modelrunner.run/models/${endpoint}/openapi.json`;
const TTL_MS = 60 * 60_000;
const RETRY_MS = 60_000;
const MAX_ENTRIES = 200;

/** One input as the schema describes it, with `$ref`, `allOf` and `anyOf` folded in. */
export interface Field {
  name: string;
  required: boolean;
  /** JSON types the value may take (`null` left out). */
  types: string[];
  /** Enum literals across every branch. */
  values: (string | number)[];
  min?: number;
  max?: number;
  minItems?: number;
  maxItems?: number;
  /** The value the endpoint uses when the input is left out. */
  default?: unknown;
  description: string;
}

export interface EndpointInputs {
  endpoint: string;
  fields: Map<string, Field>;
}

type Json = Record<string, unknown>;
const isJson = (v: unknown): v is Json => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const list = (v: unknown) => (Array.isArray(v) ? v : []);

type Shape = Omit<Field, 'name' | 'required'>;

/** Folds a schema node into one shape: references resolved, every branch's types and literals collected. */
function shapeOf(node: unknown, schemas: Json, depth = 0): Shape {
  const shape: Shape = { types: [], values: [], description: '' };
  if (!isJson(node) || depth > 8) return shape;
  const ref = typeof node.$ref === 'string' ? schemas[node.$ref.split('/').pop() ?? ''] : undefined;
  for (const branch of [ref, ...list(node.allOf), ...list(node.anyOf), ...list(node.oneOf)]) {
    const b = shapeOf(branch, schemas, depth + 1);
    shape.types.push(...b.types);
    shape.values.push(...b.values);
    shape.min ??= b.min;
    shape.max ??= b.max;
    shape.minItems ??= b.minItems;
    shape.maxItems ??= b.maxItems;
    shape.default ??= b.default;
    shape.description ||= b.description;
  }
  if (typeof node.type === 'string') shape.types.push(node.type);
  for (const v of list(node.enum)) if (typeof v === 'string' || typeof v === 'number') shape.values.push(v);
  shape.min = num(node.minimum) ?? shape.min;
  shape.max = num(node.maximum) ?? shape.max;
  shape.minItems = num(node.minItems) ?? shape.minItems;
  shape.maxItems = num(node.maxItems) ?? shape.maxItems;
  if (node.default !== undefined && node.default !== null) shape.default = node.default;
  if (typeof node.description === 'string' && node.description) shape.description = node.description;
  shape.types = [...new Set(shape.types)].filter((t) => t !== 'null');
  shape.values = [...new Set(shape.values)];
  return shape;
}

function parse(endpoint: string, doc: unknown): EndpointInputs {
  const schemas = isJson(doc) && isJson(doc.components) && isJson(doc.components.schemas) ? doc.components.schemas : null;
  const input = schemas?.Input;
  if (!schemas || !isJson(input) || !isJson(input.properties)) {
    throw new ProviderError(`ModelRunner's description of ${endpoint} has no input schema`);
  }
  const required = new Set(list(input.required).filter((r): r is string => typeof r === 'string'));
  const fields = new Map<string, Field>();
  for (const [name, node] of Object.entries(input.properties)) {
    fields.set(name, { name, required: required.has(name), ...shapeOf(node, schemas) });
  }
  return { endpoint, fields };
}

async function fetchInputs(endpoint: string): Promise<EndpointInputs | null> {
  let res: Response;
  try {
    res = await fetch(SCHEMA_URL(endpoint), { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ProviderError(`ModelRunner's description of ${endpoint} could not be read`);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new ProviderError(`ModelRunner answered ${res.status} for the description of ${endpoint}`);
  return parse(endpoint, await res.json().catch(() => null));
}

const cache = new Map<string, { expires: number; inputs: Promise<EndpointInputs | null> }>();

/** An endpoint id as ModelRunner names it: `owner/alias` plus optional mode segments, nothing that leaves the path. */
export const isEndpointId = (id: string) => /^[\w.-]+(\/[\w.-]+)+$/.test(id) && !id.split('/').some((s) => s === '.' || s === '..');

/**
 * The endpoint's inputs, or null when ModelRunner has no such endpoint. Answers (a missing endpoint included) are kept
 * for an hour. When a refresh fails the expired answer keeps serving and the read is retried a minute later; a failed
 * first read is not kept, so the next request tries again.
 */
export function readInputs(endpoint: string): Promise<EndpointInputs | null> {
  if (!isEndpointId(endpoint)) return Promise.resolve(null);
  const hit = cache.get(endpoint);
  if (hit && hit.expires > Date.now()) return hit.inputs;
  const entry = {
    expires: Date.now() + TTL_MS,
    inputs: fetchInputs(endpoint).catch((err: unknown) => {
      if (!hit) throw err;
      entry.expires = Date.now() + RETRY_MS;
      return hit.inputs;
    }),
  };
  cache.delete(endpoint);
  cache.set(endpoint, entry);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  entry.inputs.catch(() => {
    if (cache.get(endpoint) === entry) cache.delete(endpoint);
  });
  return entry.inputs;
}
