'use client';

import { Clapperboard, Loader2, Play, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ShotCard } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { cn } from '@/lib/cn';
import { posterOf } from '@/lib/media';
import { shotStateOf, shotTitle, type ShotState } from '../model';

export type ShotFilter = 'all' | ShotState;
const FILTERS: ShotFilter[] = ['all', 'pending', 'generating', 'done', 'failed'];

export const STATE_TONE = { pending: 'neutral', generating: 'info', done: 'success', failed: 'danger' } as const;

/** Column 1: the shots in order, their state from latestVideoTask, filters and (in select mode) checkboxes. */
export function TaskList({
  shots,
  selectedId,
  onSelect,
  filter,
  onFilter,
  selectMode,
  checked,
  onCheck,
  onGenerate,
  requesting,
}: {
  shots: ShotCard[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  filter: ShotFilter;
  onFilter: (filter: ShotFilter) => void;
  selectMode: boolean;
  checked: Set<number>;
  onCheck: (ids: number[], on: boolean) => void;
  onGenerate: (shot: ShotCard) => void;
  requesting: Set<number>;
}) {
  const t = useTranslations('studio.video');
  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === 'all' ? shots.length : shots.filter((s) => shotStateOf(s) === f).length]));
  const visible = filter === 'all' ? shots : shots.filter((s) => shotStateOf(s) === filter);
  const quick = (state: ShotState | 'all' | 'none') => {
    if (state === 'none') return onCheck([...checked], false);
    onCheck(shots.filter((s) => state === 'all' || shotStateOf(s) === state).map((s) => s.id), true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-1 border-b border-line p-2" role="group" aria-label={t('filter.label')}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              filter === f ? 'bg-accent-soft text-accent-soft-ink' : 'text-ink-2 hover:bg-surface-2',
            )}
          >
            {t(`filter.${f}`)} <span className="tabular-nums opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>
      {selectMode ? (
        <div className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5 text-xs">
          {(['all', 'pending', 'failed', 'none'] as const).map((q) => (
            <button key={q} type="button" onClick={() => quick(q)} className="rounded px-2 py-0.5 text-ink-2 hover:bg-surface-2">
              {t(`quick.${q}`)}
            </button>
          ))}
        </div>
      ) : null}
      <ol className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {visible.length === 0 ? <li className="p-4 text-sm text-muted">{t('filter.none')}</li> : null}
        {visible.map((shot) => {
          const state = shotStateOf(shot);
          const selected = shot.id === selectedId;
          const task = shot.latestVideoTask;
          return (
            <li key={shot.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(shot.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(shot.id))}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'group flex cursor-pointer gap-2.5 rounded-md p-2 text-[13px] transition-colors',
                  selected ? 'bg-accent-soft' : 'hover:bg-surface-2',
                )}
              >
                {selectMode ? (
                  <input
                    type="checkbox"
                    checked={checked.has(shot.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onCheck([shot.id], e.target.checked)}
                    aria-label={t('selectShot', { number: shot.shotNumber })}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                ) : null}
                <div className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-frame">
                  {shot.videoPath ? (
                    // eslint-disable-next-line @next/next/no-img-element -- media is served by the API through the proxy
                    <img src={posterOf(shot.videoPath)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Clapperboard className="h-4 w-4 text-white/40" aria-hidden />
                  )}
                  {state === 'generating' ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden />
                    </span>
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-muted">#{shot.shotNumber}</span>
                    <span className="truncate font-medium">{shotTitle(shot, t('shotN', { number: shot.shotNumber }))}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <Tag tone={STATE_TONE[state]} className="h-5 px-2">
                      {t(`state.${state}`)}
                    </Tag>
                    <span className="tabular-nums">{t('seconds', { seconds: shot.durationSeconds })}</span>
                    {shot.bindings.scene ? <span className="truncate">{shot.bindings.scene.name}</span> : null}
                  </div>
                  {state === 'failed' && task?.error ? (
                    <p className="flex items-start gap-1 text-xs text-danger">
                      <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      <span className="line-clamp-2">
                        {task.errorClass === 'moderation' ? `${t('moderationHint')} ` : ''}
                        {task.error}
                      </span>
                    </p>
                  ) : null}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 self-center opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerate(shot);
                  }}
                  disabled={state === 'generating' || requesting.has(shot.id)}
                  aria-label={t('generateShot', { number: shot.shotNumber })}
                >
                  <Play className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
