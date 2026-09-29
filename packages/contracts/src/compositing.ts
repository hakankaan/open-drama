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

/** MergeShots: every shot with a video, or the given ones; clips are always concatenated in shot order. */
export const MergeShots = z.object({
  shotIds: z.array(z.number().int().positive()).min(1).max(1000).optional(),
});
export type MergeShots = z.input<typeof MergeShots>;

export const MergeStarted = z.object({ filmId: z.number().int() });
export type MergeStarted = z.infer<typeof MergeStarted>;
