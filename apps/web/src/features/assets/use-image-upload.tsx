'use client';

import { IMAGE_UPLOAD_EXTENSIONS } from '@open-drama/contracts';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useToastError } from '@/lib/errors';
import { useUploadImage } from '../media/api';
import { useUpdateAsset } from './api';
import type { AnyAsset } from './model';

/**
 * Upload flow: POST /media/upload/image, then PATCH the asset's imagePath. Both are awaited; the card's state comes
 * from the refreshed library, not from a local flag.
 */
export function useImageUpload(dramaId: number) {
  const t = useTranslations('assets');
  const toastError = useToastError();
  const upload = useUploadImage();
  const update = useUpdateAsset(dramaId);
  const input = useRef<HTMLInputElement | null>(null);
  const target = useRef<AnyAsset | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onFile = useCallback(
    async (file: File | undefined) => {
      const item = target.current;
      if (!file || !item) return;
      setBusyId(`${item.kind}:${item.asset.id}`);
      try {
        const media = await upload.mutateAsync(file);
        await update.mutateAsync({ kind: item.kind, id: item.asset.id, body: { imagePath: media.path } });
        toast.success(t('uploaded'));
      } catch (err) {
        toastError(err);
      } finally {
        setBusyId(null);
        if (input.current) input.current.value = '';
      }
    },
    [upload, update, toastError, t],
  );

  const pick = useCallback((item: AnyAsset) => {
    target.current = item;
    input.current?.click();
  }, []);

  const fileInput = (
    <input
      ref={input}
      type="file"
      accept={IMAGE_UPLOAD_EXTENSIONS.join(',')}
      className="hidden"
      onChange={(e) => void onFile(e.target.files?.[0])}
    />
  );

  return { pick, fileInput, isBusy: (item: AnyAsset) => busyId === `${item.kind}:${item.asset.id}` };
}
