'use client';

import { AudioLines, Check, Clapperboard, Download, ImageIcon, Loader2, Mic, Minus, Play, RotateCcw, ScanEye, Star, TriangleAlert, X } from 'lucide-react';
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
import { useDeleteTask, useRequestLineAudio, useRequestLipSync, useShotVideos } from '../api';
import { shotStateOf } from '../model';
import { STATE_TONE } from './task-list';

/** The still the shot's video starts from: draw, redraw or remove it, and whether the target model will use it. */
function Keyframe({
  shot,
  save,
  onDraw,
  requesting,
  model,
  firstFrame,
  continues,
}: {
  shot: ShotCard;
  save: (patch: UpdateShot) => Promise<unknown>;
  onDraw: () => void;
  requesting: boolean;
  model: string | null;
  firstFrame: boolean;
  /** The shot this one continues: its video starts from that shot's last frame, not the keyframe (adr-0020). */
  continues: number | null;
}) {
  const t = useTranslations('studio.video.keyframes');
  const toastError = useToastError();
  const task = shot.latestKeyframeTask;
  const drawing = task?.status === 'processing';
  return (
    <section className="flex flex-col gap-2 px-4 pt-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-ink-2">{t('title')}</h3>
        <div className="ml-auto flex gap-1">
          {shot.keyframePath && !drawing ? (
            <Button size="sm" variant="quiet" onClick={() => void save({ keyframePath: null }).catch((err) => toastError(err))}>
              <X className="h-3.5 w-3.5" aria-hidden />
              {t('remove')}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onDraw} loading={requesting} disabled={drawing}>
            {requesting ? null : drawing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImageIcon className="h-3.5 w-3.5" aria-hidden />}
            {drawing ? t('drawing') : shot.keyframePath ? t('redraw') : t('draw')}
          </Button>
        </div>
      </div>
      {shot.keyframePath ? (
        <a href={mediaUrl(shot.keyframePath)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md bg-frame">
          {/* eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy */}
          <img src={mediaUrl(shot.keyframePath)} alt={t('alt', { number: shot.shotNumber })} className="mx-auto max-h-48 object-contain" />
        </a>
      ) : (
        <p className="text-xs text-muted">{t('none')}</p>
      )}
      {shot.keyframePath && shot.keyframeStale && !drawing ? (
        <div className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning" role="status">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="flex-1">{t('stale')}</span>
          <Button size="sm" variant="quiet" onClick={() => void save({ keyframeStale: false }).catch((err) => toastError(err))}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            {t('keep')}
          </Button>
        </div>
      ) : null}
      {task?.status === 'failed' && task.error ? (
        <p className="text-xs text-danger" role="alert">
          {task.error}
        </p>
      ) : null}
      {shot.keyframePath ? (
        <p className="text-xs text-muted">
          {continues !== null
            ? t('continued', { number: continues })
            : firstFrame
              ? t('used')
              : t('unsupported', { model: model ?? t('defaultModel') })}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The shot's line in its speaker's voice, and the lip sync of its video to it (adr-0021). Under pinned voices a
 * video is made silent and lip-synced to the line audio once it is done; the buttons redo either step by hand.
 */
function Voice({ shot, episodeId, pinned }: { shot: ShotCard; episodeId: number; pinned: boolean }) {
  const t = useTranslations('studio.video.voice');
  const toastError = useToastError();
  const speak = useRequestLineAudio(episodeId);
  const sync = useRequestLipSync(episodeId);
  const lineTask = shot.latestLineAudioTask;
  const syncTask = shot.latestLipSyncTask;
  const speaking = lineTask?.status === 'processing';
  const syncing = syncTask?.status === 'processing';
  const speaker = shot.bindings.characters.find((c) => c.id === shot.speakerId)?.name ?? null;
  const line = shot.line.trim();
  // A failed lip sync stops mattering once a newer video is made.
  const syncFailed = syncTask?.status === 'failed' && syncTask.id > (shot.latestVideoTask?.id ?? 0);
  const run = (mutation: typeof speak | typeof sync) => mutation.mutate({ id: shot.id }, { onError: (err) => toastError(err) });

  return (
    <section className="flex flex-col gap-2 px-4 pt-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-ink-2">{t('title')}</h3>
        {pinned ? <Tag tone="accent">{t('pinned')}</Tag> : null}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => run(speak)} loading={speak.isPending} disabled={!line || !speaker || speaking}>
            {speak.isPending ? null : speaking ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Mic className="h-3.5 w-3.5" aria-hidden />}
            {speaking ? t('speaking') : shot.lineAudioPath ? t('respeak') : t('speak')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => run(sync)}
            loading={sync.isPending}
            disabled={!shot.lineAudioPath || !shot.videoPath || syncing || shot.latestVideoTask?.status === 'processing'}
          >
            {sync.isPending ? null : syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <AudioLines className="h-3.5 w-3.5" aria-hidden />}
            {syncing ? t('syncing') : t('lipSync')}
          </Button>
        </div>
      </div>
      {line && speaker ? (
        <p className="text-xs text-ink-2">
          <span className="font-medium">{speaker}:</span> {line}
        </p>
      ) : (
        <p className="text-xs text-muted">{t('noLine')}</p>
      )}
      {shot.lineAudioPath ? (
        <div className="flex items-center gap-2">
          <audio key={shot.lineAudioPath} src={mediaUrl(shot.lineAudioPath)} controls preload="none" className="h-8 min-w-0 flex-1" />
          {shot.lineAudioSeconds ? (
            <span className="shrink-0 text-xs text-muted tabular-nums">{t('seconds', { seconds: Math.round(shot.lineAudioSeconds * 10) / 10 })}</span>
          ) : null}
        </div>
      ) : null}
      {lineTask?.status === 'failed' && lineTask.error ? (
        <p className="text-xs text-danger" role="alert">
          {lineTask.error}
        </p>
      ) : null}
      {syncFailed && syncTask.error ? (
        <p className="text-xs text-danger" role="alert">
          {t('syncFailed', { error: syncTask.error })}
        </p>
      ) : null}
      {pinned ? <p className="text-xs text-muted">{t('pinnedHint')}</p> : null}
    </section>
  );
}

const POINTS = ['people', 'outfit', 'scene', 'artifacts'] as const;

/**
 * The vision model's check of the shot's current video (adr-0022): extra people, outfits, the setting and visible
 * defects against the references. A signal to look again, never a gate; a check of an earlier video is not shown.
 */
function ShotCheck({ shot, onCheck, checking }: { shot: ShotCard; onCheck: () => void; checking: boolean }) {
  const t = useTranslations('studio.video.qa');
  const qa = shot.qa;
  const busy = shotStateOf(shot) === 'generating' || shot.latestLipSyncTask?.status === 'processing';
  return (
    <section className="flex flex-col gap-2 px-4 pt-4">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-ink-2">{t('title')}</h3>
        {qa ? <Tag tone={qa.verdict === 'ok' ? 'success' : 'warning'}>{t(`verdict.${qa.verdict}`)}</Tag> : null}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onCheck} loading={checking} disabled={!shot.videoPath || busy}>
          {checking ? null : <ScanEye className="h-3.5 w-3.5" aria-hidden />}
          {checking ? t('checking') : qa ? t('again') : t('check')}
        </Button>
      </div>
      {qa ? (
        <>
          <ul className="flex flex-col gap-1.5">
            {POINTS.map((p) => {
              const { result, note } = qa.checks[p];
              const Icon = result === 'ok' ? Check : result === 'flag' ? TriangleAlert : Minus;
              return (
                <li key={p} className="flex items-start gap-2 text-xs">
                  <Icon
                    className={cn('mt-0.5 h-3 w-3 shrink-0', result === 'ok' ? 'text-success' : result === 'flag' ? 'text-warning' : 'text-muted')}
                    aria-label={t(`result.${result}`)}
                  />
                  <span className="w-16 shrink-0 font-medium text-ink-2">{t(`points.${p}`)}</span>
                  <span className={result === 'flag' ? 'text-ink' : 'text-muted'}>{result === 'skipped' ? t('skipped') : note}</span>
                </li>
              );
            })}
          </ul>
          <p className="truncate font-mono text-[11px] text-muted" title={qa.model}>
            {t('by', { model: qa.model })}
          </p>
        </>
      ) : (
        <p className="text-xs text-muted">{shot.videoPath ? t('hint') : t('noVideo')}</p>
      )}
    </section>
  );
}

/** Column 3: the shot's current video (or a history clip under preview), its history, its keyframe, and the generate footer. */
export function ShotInspector({
  shot,
  episodeId,
  save,
  onGenerate,
  requesting,
  onKeyframe,
  keyframing,
  config,
  continues,
  pinned,
  onCheck,
  checking,
}: {
  shot: ShotCard;
  episodeId: number;
  save: (patch: UpdateShot) => Promise<unknown>;
  /** A seed retakes a version with the seed it was made with (adr-0017). */
  onGenerate: (seed?: number) => void;
  requesting: boolean;
  onKeyframe: () => void;
  keyframing: boolean;
  config: { model: string | null; resolution: Resolution; clamp: (seconds: number) => number; seeds: boolean; firstFrame: boolean };
  /** The number of the shot this one continues (adr-0020); null when it starts a take. */
  continues: number | null;
  /** The drama's pinned voices (adr-0021). */
  pinned: boolean;
  /** Checks the current video with the vision service (adr-0022). */
  onCheck: () => void;
  checking: boolean;
}) {
  const t = useTranslations('studio.video');
  const tv = useTranslations('assets.views');
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
  const shown = history.data?.find((v) => v.videoPath === playing);
  const refs = [shot.bindings.scene, ...shot.bindings.characters, ...shot.bindings.props].filter((a) => a !== null);
  // Assets the playing version left out of its call (adr-0017); a version started from a keyframe, or from the last
  // frame of the shot it continues (adr-0020), sent none.
  const fromKeyframe = Boolean(shown?.firstFrame);
  const chained = shown?.continues ?? null;
  const notSent = new Set(fromKeyframe ? refs.map((a) => a.name) : (shown?.droppedReferences ?? []));
  const notSentLabel = t(chained !== null ? 'inspector.notSentChained' : fromKeyframe ? 'inspector.notSentKeyframe' : 'inspector.notSent');
  // The images of each character the playing version was sent (adr-0018); versions made before views list none.
  const sentAs = (name: string) => shown?.sentViews[name]?.map((v) => tv(v)).join(' + ');
  // A seed only means something to the model that drew it: the retake is offered while that model is the target (the
  // offline stub stands in for every model).
  const retakable = Boolean(config.seeds && shown && (shown.provider === 'stub' || shown.model === config.model));

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
            {state === 'generating' || shot.latestLipSyncTask?.status === 'processing' ? (
              <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {state === 'generating' ? t('state.generating') : t('voice.syncing')}
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
                    {v.lipSynced ? (
                      <AudioLines className="absolute bottom-1 left-1 h-3 w-3 text-white/80" aria-label={t('inspector.lipSynced')} />
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
          {chained !== null ? (
            <p className="text-xs text-muted">{t('inspector.continued', { number: chained })}</p>
          ) : fromKeyframe ? (
            <p className="text-xs text-muted">{t('inspector.fromKeyframe')}</p>
          ) : null}
          {shown?.seed != null ? (
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate font-mono text-xs text-muted" title={shown.model}>
                {t('inspector.seed', { model: shown.model, seed: shown.seed })}
              </span>
              {retakable ? (
                <Button
                  size="sm"
                  variant="quiet"
                  className="ml-auto shrink-0"
                  onClick={() => onGenerate(shown.seed!)}
                  disabled={requesting || state === 'generating'}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  {t('inspector.retakeSeed')}
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        <ShotCheck shot={shot} onCheck={onCheck} checking={checking} />

        <Voice shot={shot} episodeId={episodeId} pinned={pinned} />

        <Keyframe
          shot={shot}
          save={save}
          onDraw={onKeyframe}
          requesting={keyframing}
          model={config.model}
          firstFrame={config.firstFrame}
          continues={continues}
        />

        <section className="flex flex-col gap-2 px-4 py-4">
          <h3 className="text-[13px] font-semibold text-ink-2">{t('inspector.references')}</h3>
          {refs.length ? (
            <ul className="flex flex-wrap gap-2">
              {refs.map((a) => (
                <li
                  key={`${a.id}:${a.name}`}
                  className={cn('flex w-16 flex-col items-center gap-1', notSent.has(a.name) && 'opacity-40')}
                  title={notSent.has(a.name) ? notSentLabel : undefined}
                >
                  <span className="flex h-12 w-16 items-center justify-center overflow-hidden rounded bg-surface-2">
                    {a.imagePath ? (
                      // eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy
                      <img src={thumbOf(a.imagePath)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-warning">{t('refs.notGenerated')}</span>
                    )}
                  </span>
                  <span className="w-full truncate text-center text-[11px] text-ink-2">
                    {a.name}
                    {notSent.has(a.name) ? (
                      <span className="sr-only"> ({notSentLabel})</span>
                    ) : null}
                  </span>
                  {sentAs(a.name) ? (
                    <span className="w-full truncate text-center text-[10px] text-muted" title={sentAs(a.name)}>
                      {sentAs(a.name)}
                    </span>
                  ) : null}
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
        <Button variant="primary" onClick={() => onGenerate()} loading={requesting} disabled={state === 'generating'}>
          {state === 'generating' ? null : shot.videoPath ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          {state === 'generating' ? t('state.generating') : shot.videoPath ? t('inspector.regenerate') : t('inspector.generate')}
        </Button>
      </footer>
    </div>
  );
}
