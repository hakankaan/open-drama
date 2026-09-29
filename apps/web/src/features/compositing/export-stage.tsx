'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Clapperboard, Download, Film as FilmIcon, Loader2, Merge, Play, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { EpisodeView, Film, ShotCard } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/cn';
import { useToastError } from '@/lib/errors';
import { mediaUrl, posterOf } from '@/lib/media';
import { relativeTime } from '@/lib/time';
import { productionKeys, useUpdateEpisode } from '../production/api';
import { useEpisodeShots } from '../storyboard/api';
import { shotTitle } from '../storyboard/model';
import { isMergeRunning, useEpisodeFilms, useMergeShots } from './api';
import { VideoPreview } from './film-preview';

/** 83 → "1:23". */
const clock = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * When a merge settles while the page is open (including one that finished before it was ever seen rendering), the
 * episode (filmPath) and the stage rail are refetched once.
 */
function useMergeSettled(films: Film[] | undefined, episode: EpisodeView) {
  const qc = useQueryClient();
  const t = useTranslations('studio.export');
  // Film id → status from the previous data; null until the first data arrives.
  const previous = useRef<Map<number, string> | null>(null);
  useEffect(() => {
    if (!films) return;
    const before = previous.current;
    previous.current = new Map(films.map((f) => [f.id, f.status]));
    if (before === null) return;
    for (const film of films) {
      const was = before.get(film.id);
      if (film.status === 'processing' || (was !== undefined && was !== 'processing')) continue;
      if (film.status === 'completed') toast.success(t('merged'));
      else toast.error(t('mergeFailed'), { description: film.error ?? undefined });
      void qc.invalidateQueries({ queryKey: productionKeys.episode(episode.id) });
      void qc.invalidateQueries({ queryKey: productionKeys.pipeline(episode.id) });
      void qc.invalidateQueries({ queryKey: productionKeys.drama(episode.dramaId) });
    }
  }, [films, episode.id, episode.dramaId, qc, t]);
}

function FilmCard({ film, current, onPlay }: { film: Film; current: boolean; onPlay: () => void }) {
  const t = useTranslations('studio.export');
  const locale = useLocale();
  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={onPlay}
        disabled={film.status !== 'completed'}
        aria-label={t('play', { id: film.id })}
        className="group relative flex aspect-video items-center justify-center overflow-hidden bg-frame"
      >
        {film.posterPath ? (
          // eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy
          <img src={mediaUrl(film.posterPath)} alt="" className="h-full w-full object-cover" />
        ) : (
          <FilmIcon className="h-6 w-6 text-white/40" aria-hidden />
        )}
        {film.status === 'completed' ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <Play className="h-8 w-8 text-white opacity-80 drop-shadow group-hover:opacity-100" aria-hidden />
          </span>
        ) : null}
        {film.status === 'processing' ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-sm text-white">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            {t('merging')}
          </span>
        ) : null}
      </button>
      <div className="flex flex-col gap-1.5 p-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-1.5">
          {film.status === 'completed' ? <Tag tone="success">{t('state.completed')}</Tag> : null}
          {film.status === 'failed' ? <Tag tone="danger">{t('state.failed')}</Tag> : null}
          {film.status === 'processing' ? <Tag tone="info">{t('state.processing')}</Tag> : null}
          {current ? <Tag tone="accent">{t('current')}</Tag> : null}
          <span className="ml-auto text-xs text-muted">{relativeTime(film.createdAt, locale)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{t('clips', { count: film.clipCount })}</span>
          {film.durationSeconds ? <span className="font-mono tabular-nums">{clock(film.durationSeconds)}</span> : null}
          {film.status === 'completed' && film.filmPath ? (
            <a
              href={mediaUrl(film.filmPath)}
              download
              className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {t('download')}
            </a>
          ) : null}
        </div>
        {film.status === 'failed' && film.error ? (
          <p className="flex items-start gap-1 text-xs text-danger" role="alert">
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span className="line-clamp-3">{film.error}</span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

function ShotTile({
  shot,
  checked,
  onCheck,
  onPreview,
}: {
  shot: ShotCard;
  checked: boolean;
  onCheck: (on: boolean) => void;
  onPreview: () => void;
}) {
  const t = useTranslations('studio.export');
  const tv = useTranslations('studio.video');
  const hasVideo = !!shot.videoPath;
  return (
    <li className={cn('flex flex-col overflow-hidden rounded-md border bg-surface', checked ? 'border-accent' : 'border-line')}>
      <button
        type="button"
        onClick={onPreview}
        disabled={!hasVideo}
        aria-label={t('previewShot', { number: shot.shotNumber })}
        className="relative flex aspect-video items-center justify-center overflow-hidden bg-frame"
      >
        {hasVideo ? (
          // eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy
          <img src={posterOf(shot.videoPath)} alt="" className="h-full w-full object-cover" />
        ) : (
          <Clapperboard className="h-5 w-5 text-white/40" aria-hidden />
        )}
      </button>
      <label className={cn('flex items-center gap-2 px-2 py-1.5 text-xs', hasVideo ? 'cursor-pointer' : 'text-muted')}>
        <input
          type="checkbox"
          checked={checked}
          disabled={!hasVideo}
          onChange={(e) => onCheck(e.target.checked)}
          aria-label={tv('selectShot', { number: shot.shotNumber })}
          className="h-4 w-4 shrink-0 accent-[var(--accent)]"
        />
        <span className="font-mono text-muted">#{shot.shotNumber}</span>
        <span className="min-w-0 flex-1 truncate">{shotTitle(shot, tv('shotN', { number: shot.shotNumber }))}</span>
        <span className="tabular-nums text-muted">
          {hasVideo ? clock(shot.videoDurationSeconds ?? shot.durationSeconds) : t('noVideo')}
        </span>
      </label>
    </li>
  );
}

/**
 * Export stage (Plan 3 §4.5): the episode's films, the shot clips to merge (only shots with a video can be selected;
 * clips are always joined in shot order), and the "Mark done" toggle that completes the episode.
 */
export function ExportStage({ episode, onVideo }: { episode: EpisodeView; onVideo: () => void }) {
  const t = useTranslations('studio.export');
  const toastError = useToastError();
  const films = useEpisodeFilms(episode.id);
  const list = useEpisodeShots(episode.id);
  const merge = useMergeShots(episode.id);
  const update = useUpdateEpisode();
  useMergeSettled(films.data, episode);
  const [checked, setChecked] = useState<Set<number> | null>(null);
  const [preview, setPreview] = useState<{ path: string; title: string } | null>(null);

  if (films.isLoading || list.isLoading || !list.data) return <Skeleton className="h-[60dvh]" />;

  const shots = list.data.shots;
  const generated = shots.filter((s) => s.videoPath);
  // Until the creator changes it, every shot with a video is selected; shots that lost their video drop out.
  const selected = new Set([...(checked ?? generated.map((s) => s.id))].filter((id) => generated.some((s) => s.id === id)));
  const rendering = films.data?.some((f) => f.status === 'processing') ?? false;
  const done = episode.status === 'completed';

  const onCheck = (id: number, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setChecked(next);
  };
  const startMerge = () =>
    merge.mutate(
      { shotIds: [...selected] },
      {
        onError: (err) => (isMergeRunning(err) ? toast.info(t('alreadyMerging')) : toastError(err)),
      },
    );

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-3xl font-semibold tracking-wide">{t('title')}</h2>
        {episode.filmDurationSeconds ? <Tag mono>{clock(episode.filmDurationSeconds)}</Tag> : null}
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-2">
          <Switch
            checked={done}
            onCheckedChange={(on) =>
              update.mutate({ id: episode.id, status: on ? 'completed' : 'active' }, { onError: (err) => toastError(err) })
            }
            disabled={update.isPending}
            label={t('markDone')}
          />
          {t('markDone')}
        </label>
      </header>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-ink-2">{t('films', { count: films.data?.length ?? 0 })}</h3>
        {films.data && films.data.length > 0 ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {films.data.map((film) => (
              <FilmCard
                key={film.id}
                film={film}
                current={!!film.filmPath && film.filmPath === episode.filmPath}
                onPlay={() => film.filmPath && setPreview({ path: film.filmPath, title: t('filmTitle', { id: film.id }) })}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-line px-4 py-6 text-sm text-muted">{t('noFilms')}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink-2">{t('shots', { done: generated.length, total: shots.length })}</h3>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setChecked(new Set(generated.map((s) => s.id)))} disabled={generated.length === 0}>
              {t('selectAll')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())} disabled={selected.size === 0}>
              {t('clear')}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={startMerge}
              disabled={selected.size === 0 || rendering}
              loading={merge.isPending || rendering}
            >
              {merge.isPending || rendering ? null : <Merge className="h-3.5 w-3.5" aria-hidden />}
              {rendering ? t('merging') : t('mergeSelected', { count: selected.size })}
            </Button>
          </div>
        </div>
        {generated.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-line px-4 py-6">
            <p className="text-sm text-muted">{shots.length === 0 ? t('noShots') : t('noClips')}</p>
            <Button size="sm" onClick={onVideo}>
              {t('toVideo')}
            </Button>
          </div>
        ) : null}
        {shots.length > 0 ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {shots.map((shot) => (
              <ShotTile
                key={shot.id}
                shot={shot}
                checked={selected.has(shot.id)}
                onCheck={(on) => onCheck(shot.id, on)}
                onPreview={() =>
                  shot.videoPath &&
                  setPreview({ path: shot.videoPath, title: shotTitle(shot, t('shotPreview', { number: shot.shotNumber })) })
                }
              />
            ))}
          </ul>
        ) : null}
      </div>

      <VideoPreview path={preview?.path ?? null} title={preview?.title ?? ''} onClose={() => setPreview(null)} />
    </section>
  );
}
