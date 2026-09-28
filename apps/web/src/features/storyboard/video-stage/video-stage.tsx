'use client';

import { CheckSquare, Clapperboard, Loader2, Play, RotateCcw, Scissors, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import type { EpisodeView, ShotCard, UpdateShot } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from '@/components/ui/tag';
import { ApiError } from '@/lib/api';
import { useToastError } from '@/lib/errors';
import { usePersistedState } from '@/lib/persisted-state';
import { useEpisodeAssets } from '../../assets/api';
import { textOverride, useModelPicks, videoOverride } from '../../configuration/model-picks';
import { useDramaDetail } from '../../production/api';
import {
  useEpisodeShots,
  useGenerateShotVideoPrompt,
  useRequestShotVideo,
  useStartBreakdown,
  useStartVideoPromptBatch,
  useUpdateShot,
} from '../api';
import { shotStateOf } from '../model';
import { useBatchVideos } from '../use-batch-videos';
import { useVideoTarget } from '../use-video-target';
import { ShotEditor } from './editor';
import { ShotInspector } from './inspector';
import { TaskList, type ShotFilter } from './task-list';

const DEFAULT_WIDTHS: [number, number] = [300, 380];

/** A drag handle between two workbench columns; double-click restores the default widths. */
function Resizer({ onDrag, onReset, label }: { onDrag: (dx: number) => void; onReset: () => void; label: string }) {
  const start = (e: ReactPointerEvent<HTMLDivElement>) => {
    let x = e.clientX;
    const move = (ev: PointerEvent) => {
      onDrag(ev.clientX - x);
      x = ev.clientX;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={start}
      onDoubleClick={onReset}
      className="w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent/30"
    />
  );
}

/** A count of shots about to be generated, with what it will use (Plan 3 §4.5), before anything is spent. */
function BatchConfirm({
  shots,
  model,
  resolution,
  clamp,
  onConfirm,
  onClose,
}: {
  shots: ShotCard[];
  model: string | null;
  resolution: string;
  clamp: (s: number) => number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('studio.video.batch');
  const seconds = shots.reduce((n, s) => n + clamp(s.durationSeconds), 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t('confirmTitle', { count: shots.length })} description={t('confirmBody')}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">{t('shots')}</dt>
          <dd className="tabular-nums">{shots.length}</dd>
          <dt className="text-muted">{t('seconds')}</dt>
          <dd className="tabular-nums">{seconds}</dd>
          <dt className="text-muted">{t('model')}</dt>
          <dd className="truncate font-mono text-xs">{model ?? t('defaultModel')}</dd>
          <dt className="text-muted">{t('resolution')}</dt>
          <dd>{resolution}</dd>
        </dl>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="primary" onClick={onConfirm}>
            {t('confirm', { count: shots.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The video production stage (Plan 3 §4.5): breakdown, prompts, and shot videos, all state derived from the server. */
export function VideoStage({ episode, onScript, onAssets }: { episode: EpisodeView; onScript: () => void; onAssets: () => void }) {
  const t = useTranslations('studio.video');
  const toastError = useToastError();
  const { picks } = useModelPicks();
  const drama = useDramaDetail(episode.dramaId);
  const list = useEpisodeShots(episode.id);
  const assets = useEpisodeAssets(episode.id);
  const breakdown = useStartBreakdown(episode.id);
  const promptBatch = useStartVideoPromptBatch(episode.id);
  const update = useUpdateShot(episode.id);
  const promptOne = useGenerateShotVideoPrompt(episode.id);
  const requestVideo = useRequestShotVideo(episode.id);
  const target = useVideoTarget(episode, picks);
  const override = videoOverride(picks);
  const batch = useBatchVideos(episode.id, override);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<ShotFilter>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [confirming, setConfirming] = useState<ShotCard[] | null>(null);
  const [breakAgain, setBreakAgain] = useState(false);
  const [requesting, setRequesting] = useState<Set<number>>(new Set());
  const [promptingId, setPromptingId] = useState<number | null>(null);
  const [widths, setWidths] = usePersistedState<[number, number]>('workbench-widths', DEFAULT_WIDTHS);

  if (!episode.scriptContent?.trim()) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col items-start gap-4 pt-10">
        <h2 className="font-display text-3xl font-semibold tracking-wide">{t('title')}</h2>
        <p className="text-ink-2">{t('needScript')}</p>
        <Button onClick={onScript}>{t('toScript')}</Button>
      </section>
    );
  }
  if (list.isLoading || !list.data) return <Skeleton className="h-96" />;

  const { shots, breakdown: job, videoPromptBatch: promptJob } = list.data;
  const breaking = job?.status === 'running';
  const prompting = promptJob?.status === 'running';
  const selected = shots.find((s) => s.id === selectedId) ?? shots[0] ?? null;
  const withoutPrompt = shots.filter((s) => !s.videoPrompt.trim()).length;
  const failed = shots.filter((s) => shotStateOf(s) === 'failed');
  const missing = shots.filter((s) => !s.videoPath && shotStateOf(s) !== 'generating');
  const batchTargets = selectMode ? shots.filter((s) => checked.has(s.id) && shotStateOf(s) !== 'generating') : missing;
  const progress = promptJob?.progress as { total?: number; completed?: number; failed?: number } | undefined;

  const startBreakdown = () =>
    breakdown.mutate(textOverride(picks), {
      onSuccess: () => setBreakAgain(false),
      onError: (err) => toastError(err),
    });
  const fillPrompts = () => promptBatch.mutate(textOverride(picks), { onError: (err) => toastError(err) });

  const save = (shotId: number) => (patch: UpdateShot) => update.mutateAsync({ id: shotId, ...patch });
  const generateOne = async (shot: ShotCard) => {
    setRequesting((s) => new Set(s).add(shot.id));
    try {
      const started = await requestVideo.mutateAsync({ id: shot.id, ...override });
      if (started.unmatchedMentions.length) toast.warning(t('unmatched', { names: started.unmatchedMentions.join(', ') }));
      if (started.droppedReferences.length) toast.warning(t('dropped', { names: started.droppedReferences.join(', ') }));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT' && !(err.details as { jobId?: number } | undefined)?.jobId) {
        toast.info(t('alreadyGenerating'));
      } else toastError(err);
    } finally {
      setRequesting((s) => {
        const next = new Set(s);
        next.delete(shot.id);
        return next;
      });
    }
  };
  const generatePrompt = async (shot: ShotCard) => {
    setPromptingId(shot.id);
    try {
      await promptOne.mutateAsync({ id: shot.id, ...textOverride(picks) });
    } catch (err) {
      toastError(err);
    } finally {
      setPromptingId(null);
    }
  };
  const onCheck = (ids: number[], on: boolean) =>
    setChecked((s) => {
      const next = new Set(s);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const lockedBanner = (
    <p className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-2">
      <Clapperboard className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      {target.lockedName
        ? t('lockedModel', { name: target.lockedName, model: target.model ?? t('inspector.defaultModel') })
        : t('noVideoService')}
    </p>
  );

  if (shots.length === 0) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col items-start gap-4 pt-10">
        <h2 className="font-display text-3xl font-semibold tracking-wide">{t('title')}</h2>
        <p className="text-ink-2">{breaking ? t('breakingBody') : t('emptyBody')}</p>
        {lockedBanner}
        {job?.status === 'failed' && job.error ? (
          <p className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t('breakdownFailed', { error: job.error })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={startBreakdown} loading={breakdown.isPending || breaking}>
            {breaking ? null : <Scissors className="h-4 w-4" aria-hidden />}
            {breaking ? t('breaking') : t('breakdown')}
          </Button>
          {(assets.data?.characters.length ?? 0) + (assets.data?.scenes.length ?? 0) === 0 ? (
            <Button onClick={onAssets}>{t('toAssets')}</Button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] min-h-[560px] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="font-display text-2xl font-semibold tracking-wide">{t('title')}</h2>
        <Tag>{t('summary', { count: shots.length, seconds: Math.round(list.data.totalDurationSeconds) })}</Tag>
        {drama.data ? <Tag mono>{drama.data.aspectRatio}</Tag> : null}
        <Tag tone={list.data.generatedCount === shots.length ? 'success' : 'neutral'}>
          {t('generated', { done: list.data.generatedCount, total: shots.length })}
        </Tag>
        {breaking ? (
          <Tag tone="info">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('breaking')}
          </Tag>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setBreakAgain(true)} disabled={breaking || prompting}>
            <Scissors className="h-3.5 w-3.5" aria-hidden />
            {t('breakAgain')}
          </Button>
          {prompting ? (
            <Tag tone="info">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t('promptProgress', { done: (progress?.completed ?? 0) + (progress?.failed ?? 0), total: progress?.total ?? 0 })}
            </Tag>
          ) : (
            <Button size="sm" variant="ghost" onClick={fillPrompts} disabled={withoutPrompt === 0 || breaking} loading={promptBatch.isPending}>
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {withoutPrompt > 0 ? t('fillPrompts', { count: withoutPrompt }) : t('promptsDone')}
            </Button>
          )}
          {failed.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={() => setConfirming(failed)} disabled={batch.running || breaking}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('retryFailed', { count: failed.length })}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={selectMode ? 'quiet' : 'ghost'}
            onClick={() => {
              setSelectMode((m) => !m);
              setChecked(new Set());
            }}
            aria-pressed={selectMode}
          >
            <CheckSquare className="h-3.5 w-3.5" aria-hidden />
            {t('selectMode')}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setConfirming(batchTargets)}
            disabled={batchTargets.length === 0 || batch.running || breaking}
            loading={batch.running}
          >
            {batch.running ? null : <Play className="h-3.5 w-3.5" aria-hidden />}
            {selectMode ? t('generateSelected', { count: batchTargets.length }) : t('generateMissing', { count: batchTargets.length })}
          </Button>
        </div>
      </div>
      {job?.status === 'failed' && job.error ? (
        <p className="border-b border-line bg-danger-soft px-4 py-1.5 text-xs text-danger" role="alert">
          {t('breakdownFailedKept', { error: job.error })}
        </p>
      ) : null}
      {promptJob?.status === 'failed' && promptJob.error ? (
        <p className="border-b border-line bg-danger-soft px-4 py-1.5 text-xs text-danger" role="alert">
          {t('promptsFailed', { error: promptJob.error })}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="shrink-0 border-r border-line" style={{ width: widths[0] }}>
          <TaskList
            shots={shots}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            filter={filter}
            onFilter={setFilter}
            selectMode={selectMode}
            checked={checked}
            onCheck={onCheck}
            onGenerate={(s) => void generateOne(s)}
            requesting={requesting}
          />
        </div>
        <Resizer
          label={t('resizeList')}
          onDrag={(dx) => setWidths(([a, b]) => [Math.min(520, Math.max(220, a + dx)), b])}
          onReset={() => setWidths(DEFAULT_WIDTHS)}
        />
        <div className="min-w-0 flex-1 overflow-y-auto">
          {selected ? (
            <ShotEditor
              key={selected.id}
              shot={selected}
              assets={assets.data}
              save={save(selected.id)}
              onGeneratePrompt={() => void generatePrompt(selected)}
              promptPending={promptingId === selected.id}
              onToAssets={onAssets}
            />
          ) : null}
        </div>
        <Resizer
          label={t('resizeInspector')}
          onDrag={(dx) => setWidths(([a, b]) => [a, Math.min(640, Math.max(300, b - dx))])}
          onReset={() => setWidths(DEFAULT_WIDTHS)}
        />
        <div className="shrink-0 border-l border-line" style={{ width: widths[1] }}>
          {selected ? (
            <ShotInspector
              key={selected.id}
              shot={selected}
              episodeId={episode.id}
              save={save(selected.id)}
              onGenerate={() => void generateOne(selected)}
              requesting={requesting.has(selected.id)}
              config={{ model: target.model, resolution: episode.resolution, clamp: target.clamp }}
            />
          ) : null}
        </div>
      </div>

      {confirming ? (
        <BatchConfirm
          shots={confirming}
          model={target.model}
          resolution={episode.resolution}
          clamp={target.clamp}
          onClose={() => setConfirming(null)}
          onConfirm={() => {
            const ids = confirming.map((s) => s.id);
            setConfirming(null);
            setChecked(new Set());
            void batch.run(ids);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={breakAgain}
        onOpenChange={setBreakAgain}
        title={t('breakAgainTitle')}
        description={t('breakAgainBody')}
        confirmLabel={t('breakAgainConfirm')}
        onConfirm={startBreakdown}
        pending={breakdown.isPending}
      />
    </div>
  );
}
