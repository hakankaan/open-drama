import { z } from 'zod';
import { FilmStatus, MediaPath, Timestamp } from './common';

/** One merge of an episode's shot videos (compositing.Film). */
export const Film = z.object({
  id: z.number().int(),
  episodeId: z.number().int(),
  status: FilmStatus,
  filmPath: MediaPath.nullable(),
  durationSeconds: z.number().nullable(),
  posterPath: MediaPath.nullable(),
  clipCount: z.number().int(),
  error: z.string().nullable(),
  createdAt: Timestamp,
  completedAt: Timestamp.nullable(),
});
export type Film = z.infer<typeof Film>;
