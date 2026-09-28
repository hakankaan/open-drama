'use client';

import { Copy, ImageOff, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';
import { useToastError } from '@/lib/errors';
import { mediaUrl } from '@/lib/media';
import { useUpdateAsset, type UpdateAssetInput } from './api';
import { ASSET_FIELDS } from './fields';
import { titleOf, type AnyAsset } from './model';

/**
 * Full field editing. Only changed fields are sent; an edited final prompt is sent as finalPrompt and wins over
 * the stale flag the other edits would set.
 */
export function AssetDetailDialog({
  item,
  dramaId,
  onClose,
  onUpload,
  uploading,
  generation,
}: {
  item: AnyAsset;
  dramaId: number;
  onClose: () => void;
  onUpload: () => void;
  uploading: boolean;
  /** Prompt and image generation, available when an episode gives the agent its context. */
  generation?: {
    onGeneratePrompt: () => Promise<string | null>;
    promptPending: boolean;
    onGenerateImage: () => void;
    imagePending: boolean;
  };
}) {
  const t = useTranslations('assets');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const update = useUpdateAsset(dramaId);
  const record = item.asset as unknown as Record<string, string>;
  const fields = ASSET_FIELDS[item.kind];
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, record[f.key] ?? ''])),
  );
  const [prompt, setPrompt] = useState(item.asset.finalPrompt ?? '');
  const [touched, setTouched] = useState(false);

  const missing = fields.find((f) => f.required && !values[f.key]?.trim());
  const changed = Object.fromEntries(
    fields.filter((f) => (values[f.key] ?? '').trim() !== (record[f.key] ?? '')).map((f) => [f.key, values[f.key]!.trim()]),
  );
  const promptChanged = prompt.trim() !== (item.asset.finalPrompt ?? '');
  const dirty = Object.keys(changed).length > 0 || promptChanged;

  const save = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (missing) return;
    if (!dirty) return onClose();
    const body = { ...changed, ...(promptChanged ? { finalPrompt: prompt.trim() || null } : {}) };
    try {
      await update.mutateAsync({ kind: item.kind, id: item.asset.id, body } as UpdateAssetInput);
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent title={titleOf(item)} description={t(`kind.${item.kind}`)} wide>
        <form onSubmit={save} className="grid gap-6 md:grid-cols-[220px_1fr]" noValidate>
          <div className="flex flex-col gap-3">
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-md bg-surface-2">
              {item.asset.imagePath ? (
                <a href={mediaUrl(item.asset.imagePath)} target="_blank" rel="noreferrer" className="h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy */}
                  <img src={mediaUrl(item.asset.imagePath)} alt={titleOf(item)} className="h-full w-full object-contain" />
                </a>
              ) : (
                <ImageOff className="h-8 w-8 text-muted" aria-hidden />
              )}
            </div>
            <Button size="sm" onClick={onUpload} loading={uploading}>
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {item.asset.imagePath ? t('card.replaceImage') : t('card.uploadImage')}
            </Button>
            {generation ? (
              <Button
                size="sm"
                variant="quiet"
                onClick={generation.onGenerateImage}
                loading={generation.imagePending}
                disabled={dirty || item.asset.latestImageTask?.status === 'processing'}
                title={dirty ? t('saveFirst') : undefined}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {item.asset.imagePath ? t('card.regenerate') : t('card.generate')}
              </Button>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            {fields.map((f) => {
              const id = `asset-${f.key}`;
              const error = touched && f.required && !values[f.key]?.trim() ? t('required') : undefined;
              return (
                <Field key={f.key} label={t(`fields.${f.key}`)} htmlFor={id} error={error}>
                  {f.multiline ? (
                    <Textarea
                      id={id}
                      value={values[f.key]}
                      maxLength={f.max}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="min-h-20"
                    />
                  ) : (
                    <Input
                      id={id}
                      value={values[f.key]}
                      maxLength={f.max}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  )}
                </Field>
              );
            })}
            <Field label={t('fields.finalPrompt')} htmlFor="asset-final-prompt" hint={t('finalPromptHint')}>
              <div className="flex flex-col gap-1.5">
                {item.asset.finalPromptStale && !promptChanged ? (
                  <Tag tone="warning" className="self-start">
                    {t('staleHint')}
                  </Tag>
                ) : null}
                <Textarea
                  id="asset-final-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-28 font-mono text-[13px]"
                  maxLength={8000}
                />
                <div className="flex gap-1.5">
                  {generation ? (
                    <Button
                      size="sm"
                      variant="quiet"
                      loading={generation.promptPending}
                      disabled={Object.keys(changed).length > 0}
                      title={Object.keys(changed).length > 0 ? t('saveFirst') : undefined}
                      onClick={async () => {
                        const next = await generation.onGeneratePrompt();
                        if (next !== null) setPrompt(next);
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden />
                      {item.asset.finalPrompt ? t('regeneratePrompt') : t('generatePrompt')}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!prompt.trim()}
                    onClick={() => {
                      void navigator.clipboard.writeText(prompt).then(() => toast.success(t('copied')));
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    {t('copy')}
                  </Button>
                </div>
              </div>
            </Field>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty}>
                {tc('save')}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
