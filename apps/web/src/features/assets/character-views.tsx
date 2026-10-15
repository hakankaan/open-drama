'use client';

import { ImageOff, Sparkles, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { coverViewOf, type CharacterCard, type CharacterView, type GeneratedView } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { mediaUrl, thumbOf } from '@/lib/media';
import { regeneratedViews } from './model';

/** The views a character's detail shows; the sheet only while it has one. */
const SHOWN: CharacterView[] = ['headshot', 'body', 'side', 'back'];

/**
 * A character's reference images (adr-0018): a strip of its views with the selected one large, upload, remove and
 * generate for that view, and one button that draws the headshot and redraws every view from it.
 */
export function CharacterViewsPanel({
  character,
  onUpload,
  uploading,
  onRemove,
  removing,
  generation,
}: {
  character: CharacterCard;
  onUpload: (view: CharacterView) => void;
  uploading: boolean;
  onRemove: (view: CharacterView) => void;
  removing: boolean;
  /** Present when an episode gives generation its context; `blocked` says why it cannot run right now. */
  generation?: { onGenerate: (views: GeneratedView[]) => void; pending: boolean; blocked?: string };
}) {
  const t = useTranslations('assets.views');
  const { views } = character;
  const [selected, setSelected] = useState<CharacterView>(() => coverViewOf(views) ?? 'headshot');
  const shown = views.sheet ? [...SHOWN, 'sheet' as const] : SHOWN;
  const path = views[selected];
  const all = regeneratedViews(views);
  const list = all.map((v) => t(v)).join(' + ');
  const busy = character.latestImageTask?.status === 'processing';
  const drawsOne = selected !== 'headshot' && selected !== 'sheet';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-surface-2">
        {path ? (
          <a href={mediaUrl(path)} target="_blank" rel="noreferrer" className="h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy */}
            <img src={mediaUrl(path)} alt={`${character.name}: ${t(selected)}`} className="h-full w-full object-contain" />
          </a>
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-xs text-muted">
            <ImageOff className="h-7 w-7" aria-hidden />
            {t('empty')}
          </span>
        )}
      </div>

      <div className={cn('grid gap-1.5', shown.length > 4 ? 'grid-cols-5' : 'grid-cols-4')} role="radiogroup" aria-label={t('strip')}>
        {shown.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected === v}
            onClick={() => setSelected(v)}
            className="flex min-w-0 flex-col items-center gap-1"
          >
            <span
              className={cn(
                'flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded border-2 bg-surface-2',
                selected === v ? 'border-accent' : 'border-transparent hover:border-line-strong',
              )}
            >
              {views[v] ? (
                // eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy
                <img
                  src={thumbOf(views[v])}
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.dataset.fallback) {
                      img.dataset.fallback = '1';
                      img.src = mediaUrl(views[v]);
                    }
                  }}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[10px] text-muted">—</span>
              )}
            </span>
            <span
              className={cn(
                'w-full truncate text-center',
                shown.length > 4 ? 'text-[10px]' : 'text-[11px]',
                views[v] ? 'text-ink-2' : 'text-muted',
              )}
            >
              {t(v)}
            </span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted">{t(`hint.${selected}`)}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => onUpload(selected)} loading={uploading} disabled={busy}>
          {uploading ? null : <Upload className="h-3.5 w-3.5" aria-hidden />}
          {t('upload')}
        </Button>
        {generation && drawsOne ? (
          <Button
            size="sm"
            variant="quiet"
            onClick={() => generation.onGenerate([selected as GeneratedView])}
            loading={generation.pending}
            disabled={busy || !!generation.blocked || !views.headshot}
            title={generation.blocked ?? (views.headshot ? undefined : t('needHeadshot'))}
          >
            {generation.pending ? null : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {t('generateOne')}
          </Button>
        ) : null}
        {path ? (
          <Button size="sm" variant="ghost" onClick={() => onRemove(selected)} loading={removing} disabled={busy} aria-label={t('remove')}>
            {removing ? null : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
            {t('remove')}
          </Button>
        ) : null}
      </div>

      {generation ? (
        <div className="flex flex-col gap-1.5 border-t border-line pt-3">
          <Button
            size="sm"
            variant="quiet"
            className="h-auto min-h-8 py-1.5 text-left whitespace-normal"
            onClick={() => generation.onGenerate(all)}
            loading={generation.pending}
            disabled={busy || !!generation.blocked}
            title={generation.blocked}
          >
            {generation.pending ? null : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {views.headshot ? t('regenerate', { views: list }) : t('generate', { views: list })}
          </Button>
          <p className="text-xs text-muted">{views.headshot ? t('redrawHint') : views.sheet ? t('fromSheetHint') : t('firstHint')}</p>
        </div>
      ) : null}
    </div>
  );
}
