'use client';

import { ImageIcon, Loader2, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AspectRatio, ShotCard } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { thumbOf } from '@/lib/media';
import { shotTitle } from '../model';

const FRAME: Record<AspectRatio, string> = {
  '16:9': 'aspect-video',
  '9:16': 'aspect-[9/16]',
  '1:1': 'aspect-square',
  adaptive: 'aspect-video',
};

/**
 * Every shot's keyframe side by side, so faces, outfits and light can be compared across the episode before any video
 * is paid for; a click opens the shot, and the missing ones are drawn in one batch.
 */
export function KeyframeSheet({
  shots,
  aspect,
  running,
  onSelect,
  onDrawMissing,
  onClose,
}: {
  shots: ShotCard[];
  aspect: AspectRatio;
  running: boolean;
  onSelect: (shotId: number) => void;
  onDrawMissing: (shotIds: number[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations('studio.video.keyframes');
  const tv = useTranslations('studio.video');
  const missing = shots.filter((s) => !s.keyframePath && s.latestKeyframeTask?.status !== 'processing');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t('sheetTitle')} description={t('sheetBody')} wide className="max-w-5xl">
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {shots.map((s) => {
            const task = s.latestKeyframeTask;
            const title = shotTitle(s, tv('shotN', { number: s.shotNumber }));
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="group flex w-full flex-col gap-1 text-left"
                  aria-label={t('open', { number: s.shotNumber })}
                >
                  <span
                    className={cn(
                      'relative flex w-full items-center justify-center overflow-hidden rounded border-2 border-transparent bg-frame group-hover:border-line-strong',
                      FRAME[aspect],
                    )}
                  >
                    {s.keyframePath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy
                      <img src={thumbOf(s.keyframePath)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-white/40" aria-hidden />
                    )}
                    {task?.status === 'processing' ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Loader2 className="h-5 w-5 animate-spin text-white" aria-label={t('drawing')} />
                      </span>
                    ) : task?.status === 'failed' ? (
                      <TriangleAlert className="absolute top-1.5 right-1.5 h-4 w-4 text-warning" aria-label={t('failed')} />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 gap-1.5 text-[11px]">
                    <span className="font-mono text-muted">#{s.shotNumber}</span>
                    <span className="truncate text-ink-2">{title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('close')}
          </Button>
          <Button
            variant="primary"
            onClick={() => onDrawMissing(missing.map((s) => s.id))}
            disabled={missing.length === 0 || running}
            loading={running}
          >
            {running ? null : <ImageIcon className="h-4 w-4" aria-hidden />}
            {t('drawMissing', { count: missing.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
