import { validator } from 'hono/validator';
import type { ValidationTargets } from 'hono';
import type { z } from 'zod';
import { ApiError } from './errors';

/**
 * Validates one request part against a contracts schema; failures become a VALIDATION_FAILED envelope.
 * Usage: `app.post('/x', v('json', Schema), (c) => c.req.valid('json'))`.
 */
export const v = <S extends z.ZodType, T extends keyof ValidationTargets>(target: T, schema: S) =>
  validator(target, (value): z.output<S> => {
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new ApiError('VALIDATION_FAILED', `Invalid ${target === 'json' ? 'body' : target}`, {
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  });
