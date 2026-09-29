'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { mediaUrl, posterOf } from '@/lib/media';

/** A stored video (a film or a shot clip) in a modal player, with a download link. */
export function VideoPreview({ path, title, onClose }: { path: string | null; title: string; onClose: () => void }) {
  const t = useTranslations('studio.export');
  return (
    <Dialog open={path !== null} onOpenChange={(open) => !open && onClose()}>
      {path ? (
        <DialogContent title={title} wide>
          <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md bg-frame">
            <video key={path} src={mediaUrl(path)} poster={posterOf(path)} controls preload="metadata" className="h-full w-full" />
          </div>
          <div className="mt-4 flex justify-end">
            <a
              href={mediaUrl(path)}
              download
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {t('download')}
            </a>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
