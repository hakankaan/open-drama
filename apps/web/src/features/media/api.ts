'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { StorageUsage, UploadedMedia } from '@open-drama/contracts';
import { request } from '@/lib/api';

export function useUploadImage() {
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.set('file', file);
      return request(UploadedMedia, 'POST', '/media/upload/image', body);
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
