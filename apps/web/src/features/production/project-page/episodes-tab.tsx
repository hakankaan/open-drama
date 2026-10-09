'use client';

import { ChevronDown, MoreHorizontal, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { Resolution as ResolutionEnum, type DramaDetail, type EpisodeSummary } from '@open-drama/contracts';
import { StatusMenu } from '@/components/status-menu';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Select } from '@/components/ui/select';
import { Tag } from '@/components/ui/tag';
import { useToastError } from '@/lib/errors';
import { relativeTime } from '@/lib/time';
import { useCreateEpisode, useDeleteEpisode, useUpdateEpisode } from '../api';
import { parseTarget, TargetLengthField } from '../episode-length';

export function AddEpisodeDialog({ drama, onClose }: { drama: DramaDetail; onClose: () => void }) {
  const t = useTranslations('project.newEpisode');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const create = useCreateEpisode();
  const nextNumber = (drama.episodes.at(-1)?.episodeNumber ?? 0) + 1;
  const [title, setTitle] = useState('');
  const [resolution, setResolution] = useState<string>('720p');
  const [length, setLength] = useState('');
  const target = parseTarget(length);

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (target === undefined) return;
    try {
      await create.mutateAsync({
        dramaId: drama.id,
        title: title.trim() || undefined,
        resolution: resolution as (typeof ResolutionEnum.options)[number],
        targetDurationSeconds: target ?? undefined,
      });
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent title={t('title', { number: nextNumber })} description={t('lockNote')}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label={t('name')} htmlFor="ep-title" hint={t('nameHint', { number: nextNumber })}>
            <Input id="ep-title" autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={t('resolution')} htmlFor="ep-resolution" hint={t('resolutionHint')}>
            <Select
              id="ep-resolution"
              value={resolution}
              onValueChange={setResolution}
              options={ResolutionEnum.options.map((r) => ({ value: r, label: r }))}
            />
          </Field>
          <TargetLengthField id="ep-length" value={length} onChange={setLength} />
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={create.isPending} disabled={target === undefined}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function EpisodeCard({ drama, episode, onDelete }: { drama: DramaDetail; episode: EpisodeSummary; onDelete: () => void }) {
  const t = useTranslations('project.episode');
  const locale = useLocale();
  const toastError = useToastError();
  const update = useUpdateEpisode();
  const href = `/drama/${drama.id}/episode/${episode.episodeNumber}`;
  const patch = (body: Parameters<typeof update.mutate>[0]) => update.mutate(body, { onError: (err) => toastError(err) });

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="font-display text-4xl leading-none font-bold tracking-wide text-muted tabular-nums">
          {String(episode.episodeNumber).padStart(2, '0')}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate font-medium hover:underline">
            {episode.title}
          </Link>
          <p className="text-xs text-muted">
            <time dateTime={episode.updatedAt}>{relativeTime(episode.updatedAt, locale)}</time>
          </p>
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mt-1 -mr-2 h-8 w-8" aria-label={t('more')}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </MenuTrigger>
          <MenuContent keepFocus>
            <MenuItem danger onSelect={onDelete}>
              {t('delete')}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusMenu value={episode.status} onChange={(status) => patch({ id: episode.id, status })} />
        <Menu>
          <MenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-2 pr-1.5 pl-2.5 font-mono text-[11px] text-ink-2 hover:bg-surface-3"
              aria-label={t('resolution', { resolution: episode.resolution })}
            >
              {episode.resolution}
              <ChevronDown className="h-3 w-3" aria-hidden />
            </button>
          </MenuTrigger>
          <MenuContent align="start">
            {ResolutionEnum.options.map((r) => (
              <MenuItem key={r} checked={r === episode.resolution} onSelect={() => r !== episode.resolution && patch({ id: episode.id, resolution: r })}>
                {r}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        {episode.hasScript ? <Tag tone="success">{t('scriptReady')}</Tag> : null}
        {episode.filmPath ? <Tag tone="accent">{t('merged')}</Tag> : null}
        {episode.durationSeconds > 0 ? <Tag>{formatDuration(episode.durationSeconds)}</Tag> : null}
      </div>
      <Link
        href={href}
        className="mt-auto inline-flex h-9 items-center justify-center rounded-md border border-line text-sm font-medium transition-colors hover:border-line-strong hover:bg-surface-2"
      >
        {t('open')}
      </Link>
    </article>
  );
}

export function EpisodesTab({ drama, onAdd }: { drama: DramaDetail; onAdd: () => void }) {
  const t = useTranslations('project');
  const toastError = useToastError();
  const remove = useDeleteEpisode(drama.id);
  const [deleting, setDeleting] = useState<EpisodeSummary | null>(null);
  const nextNumber = (drama.episodes.at(-1)?.episodeNumber ?? 0) + 1;

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {drama.episodes.map((episode) => (
          <EpisodeCard key={episode.id} drama={drama} episode={episode} onDelete={() => setDeleting(episode)} />
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-ink-2 transition-colors hover:border-accent hover:text-accent-soft-ink"
        >
          <Plus className="h-5 w-5" aria-hidden />
          <span className="text-sm font-medium">{t('addEpisodeN', { number: nextNumber })}</span>
        </button>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteEpisodeTitle', { title: deleting?.title ?? '' })}
        description={t('deleteEpisodeBody')}
        confirmLabel={t('deleteEpisodeConfirm')}
        onConfirm={confirmDelete}
        pending={remove.isPending}
      />
    </>
  );
}
