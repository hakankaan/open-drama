import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode } from '@open-drama/contracts';

const STATUS: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  FORBIDDEN: 403,
  PRECONDITION_FAILED: 412,
  PROVIDER_ERROR: 502,
  INTERNAL: 500,
};

export class ApiError extends Error {
  readonly status: ContentfulStatusCode;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const notFound = (what: string) => new ApiError('NOT_FOUND', `${what} not found`);
export const forbidden = (message: string) => new ApiError('FORBIDDEN', message);
export const conflict = (message: string, details?: unknown) => new ApiError('CONFLICT', message, details);
export const precondition = (message: string, details?: unknown) =>
  new ApiError('PRECONDITION_FAILED', message, details);
/** An update with no fields is a client error (drizzle refuses an empty SET). */
export function assertSomething(input: object): void {
  if (Object.keys(input).length === 0) throw new ApiError('VALIDATION_FAILED', 'Nothing to update');
}

export const invalid = (message: string, details?: unknown) => new ApiError('VALIDATION_FAILED', message, details);
