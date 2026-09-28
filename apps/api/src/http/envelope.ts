import type { Context } from 'hono';

export const ok = <T>(c: Context, data: T) => c.json({ data }, 200);
export const created = <T>(c: Context, data: T) => c.json({ data }, 201);
