'use client';

import { Clapperboard, Download, Loader2, Play, RotateCcw, Star, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { SHOT_DURATION_MAX, SHOT_DURATION_MIN, type Resolution, type ShotCard, type UpdateShot } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { useToastError } from '@/lib/errors';
import { mediaUrl, posterOf, thumbOf } from '@/lib/media';
import { useDeleteTask, useShotVideos } from '../api';
import { shotStateOf } from '../model';
import { STATE_TONE } from './task-list';

/** Column 3: the shot's current video (or a history clip under preview), its history, and the generate footer. */
export function ShotInspector({
  shot,
  episodeId,
  save,
  onGenerate,
  requesting,
  config,
}: {
  shot: ShotCard;
  episodeId: number;
  save: (patch: UpdateShot) => Promise<unknown>;
  onGenerate: () => void;
  requesting: boolean;
  config: { model: string | null; resolution: Resolution; clamp: (seconds: number) => number };
}) {
  const t = useTranslations('studio.video');
  const toastError = useToastError();
  const state = shotStateOf(shot);
  const task = shot.latestVideoTask;
  const history = useShotVideos(shot.id, `${task?.id ?? 0}:${task?.status ?? ''}:${shot.videoPath ?? ''}`);
  const removeTask = useDeleteTask(episodeId);
  const [preview, setPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(String(shot.durationSeconds));
  const [durationSeen, setDurationSeen] = useState(shot.durationSeconds);
  if (durationSeen !== shot.durationSeconds) {
    setDurationSeen(shot.durationSeconds);
    setDuration(String(shot.durationSeconds));
  }
  const playing = preview ?? shot.videoPath;
  const previewingOther = !!preview && preview !== shot.videoPath;
  const refs = [shot.bindings.scene, ...shot.bindings.characters, ...shot.bindings.props].filter((a) => a !== null);

  const commitDuration = () => {
    const n = Number(duration);
    if (!Number.isFinite(n) || n < SHOT_DURATION_MIN || n > SHOT_DURATION_MAX) {
      setDuration(String(shot.durationSeconds));
      return;
    }
    if (n !== shot.durationSeconds) void save({ durationSeconds: n }).catch((err) => toastError(err));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <span className="font-mono text-xs text-muted">#{shot.shotNumber}</span>
          <Tag tone={STATE_TONE[state]}>{t(`state.${state}`)}</Tag>
          {shot.videoDurationSeconds ? (
            <span className="text-xs text-muted tabular-nums">{t('seconds', { seconds: Math.round(shot.videoDurationSeconds * 10) / 10 })}</span>
          ) : null}
          <div className="ml-auto flex gap-1">
            {previewingOther ? (
              <Button
                size="sm"
                variant="quiet"
                onClick={() =>
                  void save({ videoPath: preview! })
                    .then(() => setPreview(null))
                    .catch((err) => toastError(err))
                }
              >
                <Star className="h-3.5 w-3.5" aria-hidden />
                {t('inspector.setMain')}
              </Button>
            ) : null}
            {playing ? (
              <Tooltip content={t('inspector.download')}>
                <a
                  href={mediaUrl(playing)}
                  download
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2"
                  aria-label={t('inspector.download')}
                >
                  <Download className="h-4 w-4" />
                </a>
              </Tooltip>
            ) : null}
          </div>
        </div>

        <div className="px-4">
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-md bg-frame">
            {playing ? (
              <video key={playing} src={mediaUrl(playing)} poster={posterOf(playing)} controls preload="none" className="h-full w-full" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/60">
                <Clapperboard className="h-6 w-6" aria-hidden />
                <span className="text-xs">{t('inspector.noVideo')}</span>
              </div>
            )}
            {state === 'generating' ? (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {t('state.generating')}
              </span>
            ) : null}
          </div>
          {state === 'failed' && task?.error ? (
            <p className="mt-2 text-xs text-danger" role="alert">
              {task.errorClass === 'moderation' ? `${t('moderationHint')} ` : ''}
              {task.error}
            </p>
          ) : null}
        </div>

        <section className="flex flex-col gap-2 px-4 pt-4">
          <h3 className="text-[13px] font-semibold text-ink-2">{t('inspector.history', { count: history.data?.length ?? 0 })}</h3>
          {history.data?.length ? (
            <ul className="flex flex-wrap gap-2">
              {history.data.map((v) => (
                <li key={v.taskId} className="relative">
                  <button
                    type="button"
                    onClick={() => setPreview(v.videoPath === shot.videoPath ? null : v.videoPath)}
                    className={cn(
                      'relative block h-14 w-24 overflow-hidden rounded border-2 bg-frame',
                      v.videoPath === playing ? 'border-accent' : 'border-transparent hover:border-line-strong',
                    )}
                    aria-label={t('inspector.previewClip', { seconds: Math.round(v.durationSeconds ?? 0) })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy */}
                    <img src={posterOf(v.videoPath)} alt="" className="h-full w-full object-cover" />
                    {v.current ? (
                      <Star className="absolute top-1 left-1 h-3 w-3 fill-warning text-warning" aria-label={t('inspector.main')} />
                    ) : null}
                    <Play className="absolute right-1 bottom-1 h-3 w-3 text-white/80" aria-hidden />
                  </button>
                  {!v.current ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (preview === v.videoPath) setPreview(null);
                        removeTask.mutate(v.taskId, { onError: (err) => toastError(err) });
                      }}
                      className="absolute -top-1.5 -right-1.5 rounded-full bg-surface p-0.5 text-muted shadow-sm hover:text-danger"
                      aria-label={t('inspector.deleteClip')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">{t('inspector.noHistory')}</p>
          )}
        </section>

        <section className="flex flex-col gap-2 px-4 py-4">
          <h3 className="text-[13px] font-semibold text-ink-2">{t('inspector.references')}</h3>
          {refs.length ? (
            <ul className="flex flex-wrap gap-2">
              {refs.map((a) => (
                <li key={`${a.id}:${a.name}`} className="flex w-16 flex-col items-center gap-1">
                  <span className="flex h-12 w-16 items-center justify-center overflow-hidden rounded bg-surface-2">
                    {a.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy
                      <img src={thumbOf(a.imagePath)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-warning">{t('refs.notGenerated')}</span>
                    )}
                  </span>
                  <span className="w-full truncate text-center text-[11px] text-ink-2">{a.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">{t('refs.noneBound')}</p>
          )}
        </section>
      </div>

      <footer className="flex flex-col gap-2 border-t border-line bg-surface p-3">
        <div className="flex items-center gap-2">
          <label htmlFor={`duration-${shot.id}`} className="text-xs text-ink-2">
            {t('inspector.duration')}
          </label>
          <Input
            id={`duration-${shot.id}`}
            type="number"
            min={SHOT_DURATION_MIN}
            max={SHOT_DURATION_MAX}
            step={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={commitDuration}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="h-8 w-20 text-[13px]"
          />
          <span className="min-w-0 truncate text-xs text-muted" title={config.model ?? undefined}>
            {t('inspector.config', {
              model: config.model ?? t('inspector.defaultModel'),
              resolution: config.resolution,
              seconds: config.clamp(shot.durationSeconds),
            })}
          </span>
        </div>
        <Button variant="primary" onClick={onGenerate} loading={requesting} disabled={state === 'generating'}>
          {state === 'generating' ? null : shot.videoPath ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          {state === 'generating' ? t('state.generating') : shot.videoPath ? t('inspector.regenerate') : t('inspector.generate')}
        </Button>
      </footer>
    </div>
  );
}
