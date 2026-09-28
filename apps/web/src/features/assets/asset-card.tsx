'use client';

import { ImageOff, Loader2, Sparkles, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { mediaUrl, thumbOf } from '@/lib/media';
import { readinessOf, summaryOf, titleOf, type AnyAsset } from './model';

export function AssetCard({
  item,
  onOpen,
  onUpload,
  uploading,
  onGenerate,
  generating,
  generateDisabled,
  onDelete,
}: {
  item: AnyAsset;
  onOpen: () => void;
  onUpload: () => void;
  uploading?: boolean;
  /** Present when the image can be generated here; `generateDisabled` explains why it cannot right now. */
  onGenerate?: () => void;
  generating?: boolean;
  generateDisabled?: string;
  onDelete?: () => void;
}) {
  const t = useTranslations('assets.card');
  const { asset } = item;
  const readiness = readinessOf(asset);
  const summary = summaryOf(item);
  return (
    <article className="group flex overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong">
      <button
        type="button"
        onClick={onOpen}
        className="relative flex w-28 shrink-0 items-center justify-center bg-surface-2 sm:w-32"
        aria-label={t('open', { name: titleOf(item) })}
      >
        {asset.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy
          <img
            src={thumbOf(asset.imagePath)}
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.dataset.fallback) {
                img.dataset.fallback = '1';
                img.src = mediaUrl(asset.imagePath);
              }
            }}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageOff className="h-6 w-6 text-muted" aria-hidden />
        )}
        {readiness === 'generating' ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45">
            <Loader2 className="h-6 w-6 animate-spin text-white" aria-label={t('generating')} />
          </span>
        ) : null}
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-start gap-2">
          <button type="button" onClick={onOpen} className="min-w-0 text-left">
            <h3 className="truncate font-medium">{titleOf(item)}</h3>
          </button>
          <span className="ml-auto shrink-0">
            {readiness === 'ready' ? (
              <Tag tone="success">{t('ready')}</Tag>
            ) : readiness === 'generating' ? (
              <Tag tone="info">{t('generating')}</Tag>
            ) : readiness === 'failed' ? (
              <Tag tone="danger">{t('failed')}</Tag>
            ) : (
              <Tag>{t('noImage')}</Tag>
            )}
          </span>
        </div>
        {summary ? <p className="line-clamp-2 text-[13px] text-ink-2">{summary}</p> : null}
        {asset.finalPrompt ? (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="truncate font-mono">{asset.finalPrompt}</span>
            {asset.finalPromptStale ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-warning">
                <TriangleAlert className="h-3 w-3" aria-hidden />
                {t('stale')}
              </span>
            ) : null}
          </p>
        ) : null}
        {readiness === 'failed' && asset.latestImageTask?.error ? (
          <p className="line-clamp-1 text-xs text-danger">{asset.latestImageTask.error}</p>
        ) : null}
        <div className="mt-auto flex items-center justify-end gap-1 pt-1">
          {onDelete ? (
            <Tooltip content={t('delete')}>
              <Button size="icon" variant="ghost" className="mr-auto h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={onDelete} aria-label={t('delete')}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          ) : null}
          {onGenerate ? (
            <Tooltip content={asset.imagePath ? t('replaceImage') : t('uploadImage')}>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onUpload}
                loading={uploading}
                disabled={readiness === 'generating'}
                aria-label={asset.imagePath ? t('replaceImage') : t('uploadImage')}
              >
                {uploading ? null : <Upload className="h-3.5 w-3.5" />}
              </Button>
            </Tooltip>
          ) : (
            <Button size="sm" variant="ghost" onClick={onUpload} loading={uploading} disabled={readiness === 'generating'}>
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {asset.imagePath ? t('replaceImage') : t('uploadImage')}
            </Button>
          )}
          {onGenerate ? (
            generateDisabled ? (
              <Tooltip content={generateDisabled}>
                <span>
                  <Button size="sm" variant="quiet" disabled>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    {asset.imagePath ? t('regenerate') : t('generate')}
                  </Button>
                </span>
              </Tooltip>
            ) : (
              <Button size="sm" variant="quiet" onClick={onGenerate} loading={generating} disabled={readiness === 'generating'}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {asset.imagePath ? t('regenerate') : t('generate')}
              </Button>
            )
          ) : null}
        </div>
      </div>
    </article>
  );
}
