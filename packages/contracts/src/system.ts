import { z } from 'zod';

export const Health = z.object({
  status: z.literal('ok'),
  version: z.string(),
  timestamp: z.string(),
});
export type Health = z.infer<typeof Health>;
