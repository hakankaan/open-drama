import { z } from 'zod';
import { MediaPath, Timestamp } from './common';

export const UploadedMedia = z.object({
  path: MediaPath,
  url: z.string(),
});
export type UploadedMedia = z.infer<typeof UploadedMedia>;

export const StorageBucket = z.enum(['database', 'images', 'videos', 'merged', 'uploads', 'temp', 'workspace', 'other']);
export type StorageBucket = z.infer<typeof StorageBucket>;

export const StorageUsage = z.object({
  mode: z.enum(['local', 'docker']),
  dataDir: z.string(),
  storageRoot: z.string(),
  databasePath: z.string(),
  workspaceDir: z.string(),
  usageByBucket: z.array(z.object({ bucket: StorageBucket, bytes: z.number(), files: z.number().int() })),
  totalBytes: z.number(),
  freeBytes: z.number().nullable(),
  computedAt: Timestamp.nullable(),
  stale: z.boolean(),
});
export type StorageUsage = z.infer<typeof StorageUsage>;

/** Stored files nothing refers to any more (older than the grace period); also the result of cleaning them up. */
export const OrphanedMedia = z.object({
  files: z.number().int(),
  bytes: z.number(),
  byBucket: z.array(z.object({ bucket: StorageBucket, files: z.number().int(), bytes: z.number() })),
  graceHours: z.number(),
});
export type OrphanedMedia = z.infer<typeof OrphanedMedia>;

export const IMAGE_UPLOAD_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'] as const;
export const IMAGE_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

export const VIDEO_UPLOAD_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v'] as const;
export const VIDEO_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const AUDIO_UPLOAD_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac'] as const;
export const AUDIO_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
