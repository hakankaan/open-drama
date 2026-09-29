import type { z } from 'zod';
import { API_BASE, ErrorEnvelope, type ErrorCode, type TaskErrorClass } from '@open-drama/contracts';

/** An API failure: the error envelope's code, or NETWORK when the server could not be reached. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly errorClass?: TaskErrorClass,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Calls `/api/v1{path}`, unwraps the `{ data }` envelope and parses it with the contract schema.
 * FormData bodies are sent as multipart; anything else as JSON.
 */
export async function request<S extends z.ZodType>(
  schema: S,
  method: Method,
  path: string,
  body?: unknown,
): Promise<z.output<S>> {
  const init: RequestInit = { method, headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(API_BASE + path, init);
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the Open Drama server', 0);
  }

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ErrorEnvelope.safeParse(payload);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      const errorClass = (details as { errorClass?: TaskErrorClass } | undefined)?.errorClass;
      throw new ApiError(code, message, res.status, details, errorClass);
    }
    // The API always answers with an envelope, so a bare 5xx comes from the web proxy failing to reach it.
    throw new ApiError(res.status >= 500 ? 'NETWORK' : 'INTERNAL', `Request failed (${res.status})`, res.status);
  }
  const data = schema.safeParse((payload as { data?: unknown } | null)?.data);
  if (!data.success) {
    throw new ApiError('INTERNAL', 'Unexpected response from the server', res.status, data.error.issues);
  }
  return data.data;
}

/** Builds a query string from defined values. */
export const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};
