'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { StorageUsage, UploadedMedia } from '@open-drama/contracts';
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
