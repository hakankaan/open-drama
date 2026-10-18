'use client';

import { Copy, ImageOff, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { DESCRIBABLE_FIELDS, type CharacterView, type EpisodeCharacterCard, type GeneratedView } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/cn';
import { useToastError } from '@/lib/errors';
import { mediaUrl } from '@/lib/media';
import { useUpdateAsset, type UpdateAssetInput } from './api';
import { CharacterOutfit } from './character-outfit';
import { CharacterViewsPanel } from './character-views';
import { CharacterVoice } from './character-voice';
import { ASSET_FIELDS } from './fields';
import { titleOf, type AnyAsset } from './model';
import type { Described } from './use-asset-generation';

/**
 * Full field editing. Only changed fields are sent; an edited final prompt is sent as finalPrompt and wins over
 * the stale flag the other edits would set. The asset designer fills the empty describing fields from the story,
 * or, after a confirmation, writes every one afresh (adr-0024); the fields are locked meanwhile.
 */
export function AssetDetailDialog({
  item,
  dramaId,
  onClose,
  onUpload,
  uploading,
  generation,
  outfit,
}: {
  item: AnyAsset;
  dramaId: number;
  onClose: () => void;
  /** A character's upload goes to the view given (adr-0018). */
  onUpload: (view?: CharacterView) => void;
  uploading: boolean;
  /** Prompt and image generation, in the episode's context from the studio and in the drama's from the library (adr-0024). */
  generation?: {
    onGeneratePrompt: () => Promise<string | null>;
    promptPending: boolean;
    /** A character draws the views given, else its headshot and the views drawn from it. */
    onGenerateImage: (views?: GeneratedView[]) => void;
    imagePending: boolean;
    /** DescribeAsset: the empty describing fields, or every one with `replace`; null when refused or failed. */
    onDescribe: (replace: boolean) => Promise<Described>;
    describePending: boolean;
  };
  /** Opened from an episode: the character as that episode dresses it (adr-0023). */
  outfit?: { character: EpisodeCharacterCard; episodeId: number };
}) {
  const t = useTranslations('assets');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const update = useUpdateAsset(dramaId);
  const detach = useUpdateAsset(dramaId);
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

  // The describing fields the designer may write (adr-0024): the empty ones are filled, every one is rewritten on request.
  const describable: readonly string[] = DESCRIBABLE_FIELDS[item.kind];
  const emptyDescribable = describable.filter((k) => !(record[k] ?? '').trim());
  const describing = generation?.describePending ?? false;
  // A save is refused while a description, a prompt or an image request holds the asset's claim (adr-0024).
  const busy = describing || (generation?.promptPending ?? false) || (generation?.imagePending ?? false);
  const [confirmDescribe, setConfirmDescribe] = useState(false);
  const describe = async (replace: boolean) => {
    const next = await generation?.onDescribe(replace);
    setConfirmDescribe(false);
    if (!next) return;
    const fresh = next as unknown as Record<string, string>;
    setValues((v) => ({ ...v, ...Object.fromEntries(describable.map((k) => [k, fresh[k] ?? ''])) }));
    toast.success(t('described', { name: titleOf(item) }));
  };

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
        <form
          onSubmit={save}
          className={cn('grid gap-6', item.kind === 'character' ? 'md:grid-cols-[260px_1fr]' : 'md:grid-cols-[220px_1fr]')}
          noValidate
        >
          {item.kind === 'character' ? (
            <CharacterViewsPanel
              character={item.asset}
              onUpload={onUpload}
              uploading={uploading}
              onRemove={(view) =>
                detach.mutate({ kind: 'character', id: item.asset.id, body: { views: { [view]: null } } }, { onError: (err) => toastError(err) })
              }
              removing={detach.isPending}
              generation={
                generation
                  ? { onGenerate: generation.onGenerateImage, pending: generation.imagePending, blocked: dirty ? t('saveFirst') : undefined }
                  : undefined
              }
            />
          ) : (
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
              <Button size="sm" onClick={() => onUpload()} loading={uploading}>
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {item.asset.imagePath ? t('card.replaceImage') : t('card.uploadImage')}
              </Button>
              {generation ? (
                <Button
                  size="sm"
                  variant="quiet"
                  onClick={() => generation.onGenerateImage()}
                  loading={generation.imagePending}
                  disabled={dirty || item.asset.latestImageTask?.status === 'processing'}
                  title={dirty ? t('saveFirst') : undefined}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {item.asset.imagePath ? t('card.regenerate') : t('card.generate')}
                </Button>
              ) : null}
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-4">
            {generation ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="quiet"
                  loading={describing}
                  disabled={dirty}
                  title={dirty ? t('saveFirst') : emptyDescribable.length > 0 ? t('describeHint') : undefined}
                  onClick={() => (emptyDescribable.length > 0 ? void describe(false) : setConfirmDescribe(true))}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {emptyDescribable.length > 0 ? t('describe') : t('describeAgain')}
                </Button>
                {emptyDescribable.length > 0 ? <span className="text-xs text-muted">{t('describeHint')}</span> : null}
              </div>
            ) : null}
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
                      disabled={describing}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="min-h-20"
                    />
                  ) : (
                    <Input
                      id={id}
                      value={values[f.key]}
                      maxLength={f.max}
                      disabled={describing}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  )}
                </Field>
              );
            })}
            {item.kind === 'character' && outfit ? (
              <CharacterOutfit character={outfit.character} episodeId={outfit.episodeId} dramaId={dramaId} />
            ) : null}
            {item.kind === 'character' ? <CharacterVoice character={item.asset} dramaId={dramaId} /> : null}
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
              <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty || busy}>
                {tc('save')}
              </Button>
            </DialogFooter>
          </div>
        </form>
        <ConfirmDialog
          open={confirmDescribe}
          onOpenChange={(o) => !o && !describing && setConfirmDescribe(false)}
          title={t('describeAgainTitle', { name: titleOf(item) })}
          description={t('describeAgainBody')}
          confirmLabel={t('describeAgain')}
          onConfirm={() => void describe(true)}
          pending={describing}
          danger={false}
        />
      </DialogContent>
    </Dialog>
  );
}
