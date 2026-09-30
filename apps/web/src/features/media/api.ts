'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OrphanedMedia, StorageUsage, UploadedMedia } from '@open-drama/contracts';
import { request } from '@/lib/api';

export type UploadKind = 'image' | 'video' | 'audio';

/** UploadMedia: the stored path comes back; attaching it to an asset or shot is the caller's next request. */
export function useUploadMedia(kind: UploadKind) {
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.set('file', file);
      return request(UploadedMedia, 'POST', `/media/upload/${kind}`, body);
    },
  });
}

/** Polls every 2 s while the server is still counting (stale-while-revalidate). */
export const useStorageUsage = () =>
  useQuery({
    queryKey: ['media', 'storage'],
    queryFn: () => request(StorageUsage, 'GET', '/storage'),
    refetchInterval: (query) => (query.state.data?.stale ? 2000 : false),
  });

/** OrphanedMedia: what a cleanup would remove right now. */
export const useOrphanedMedia = () =>
  useQuery({
    queryKey: ['media', 'orphans'],
    queryFn: () => request(OrphanedMedia, 'GET', '/storage/orphans'),
  });

/** CleanUpOrphanedMedia: the server works the list out again; usage and the preview are refetched afterwards. */
export function useCleanUpOrphanedMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request(OrphanedMedia, 'DELETE', '/storage/orphans'),
    onSettled: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });
}
