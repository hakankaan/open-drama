'use client';

import { Check, ChevronsLeft, ChevronsRight, Circle, CircleDot, Clapperboard, FileText, Film, Images, PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { EpisodePipelineStatus } from '@open-drama/contracts';
import { cn } from '@/lib/cn';

export type Panel = 'raw' | 'rewrite' | 'assets' | 'video' | 'export';
export type StepState = 'done' | 'active' | 'idle';

/** Stage rail (Plan 3 §4.6), derived from EpisodePipelineStatus, never stored. */
export function deriveStages(p: EpisodePipelineStatus | undefined) {
  const assetsTotal = p ? p.characters.total + p.scenes.total + p.props.total : 0;
  const assetsDone = p ? p.characters.done + p.scenes.done + p.props.done : 0;
  return {
    raw: p ? p.script.state !== 'empty' : false,
    script: p?.script.state === 'done',
    assets: assetsTotal > 0 && assetsDone >= assetsTotal,
    assetsProgress: { done: assetsDone, total: assetsTotal },
    videos: !!p && p.shots.total > 0 && p.videos.done >= p.videos.total,
    videosProgress: { done: p?.videos.done ?? 0, total: p?.shots.total ?? 0 },
    exported: !!p?.completed,
  };
}

const SECTIONS: { key: string; items: { panel: Panel; icon: typeof FileText }[] }[] = [
  { key: 'script', items: [{ panel: 'raw', icon: FileText }, { panel: 'rewrite', icon: PenLine }] },
  { key: 'production', items: [{ panel: 'assets', icon: Images }, { panel: 'video', icon: Clapperboard }] },
  { key: 'export', items: [{ panel: 'export', icon: Film }] },
];

const MARQUEE: { key: 'script' | 'assets' | 'video' | 'export'; panel: Panel }[] = [
  { key: 'script', panel: 'raw' },
  { key: 'assets', panel: 'assets' },
  { key: 'video', panel: 'video' },
  { key: 'export', panel: 'export' },
];

export function StudioSidebar({
  panel,
  onPanel,
  pipeline,
  collapsed,
  onCollapse,
}: {
  panel: Panel;
  onPanel: (panel: Panel) => void;
  pipeline: EpisodePipelineStatus | undefined;
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}) {
  const t = useTranslations('studio.sidebar');
  const s = deriveStages(pipeline);
  const done: Record<Panel, boolean> = { raw: s.raw, rewrite: s.script, assets: s.assets, video: s.videos, export: s.exported };
  const segmentDone = { script: s.script, assets: s.assets, video: s.videos, export: s.exported };
  const segmentOf = (p: Panel) => (p === 'raw' || p === 'rewrite' ? 'script' : p === 'assets' ? 'assets' : p === 'video' ? 'video' : 'export');

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col gap-5 border-r border-line bg-surface py-4 transition-[width] duration-200',
        collapsed ? 'w-14 px-2' : 'w-60 px-3',
      )}
      aria-label={t('label')}
    >
      <div className={cn('flex gap-1', collapsed ? 'flex-col' : 'px-1')} role="group" aria-label={t('progress')}>
        {MARQUEE.map((m) => {
          const current = segmentOf(panel) === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onPanel(m.panel)}
              title={t(`stage.${m.key}`)}
              aria-label={t(`stage.${m.key}`)}
              className={cn(
                'rounded-full transition-colors',
                collapsed ? 'h-6 w-1.5 self-center' : 'h-1.5 flex-1',
                current ? 'bg-accent-gradient' : segmentDone[m.key] ? 'bg-success' : 'bg-surface-3 hover:bg-line-strong',
              )}
            />
          );
        })}
      </div>

      <nav className="flex flex-1 flex-col gap-4">
        {SECTIONS.map((section) => (
          <div key={section.key} className="flex flex-col gap-0.5">
            {!collapsed ? <p className="px-2 pb-1 text-xs font-medium text-muted">{t(`section.${section.key}`)}</p> : null}
            {section.items.map(({ panel: p, icon: Icon }) => {
              const active = panel === p;
              const state: StepState = done[p] ? 'done' : active ? 'active' : 'idle';
              const StateIcon = state === 'done' ? Check : state === 'active' ? CircleDot : Circle;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPanel(p)}
                  aria-current={active ? 'step' : undefined}
                  title={collapsed ? t(`panel.${p}`) : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
                    active ? 'bg-accent-soft text-accent-soft-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                    collapsed && 'justify-center',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed ? (
                    <>
                      <span className="flex-1 truncate">{t(`panel.${p}`)}</span>
                      <StateIcon
                        className={cn('h-3.5 w-3.5 shrink-0', state === 'done' ? 'text-success' : 'text-muted')}
                        aria-label={t(`state.${state}`)}
                      />
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        type="button"
        onClick={() => onCollapse(!collapsed)}
        className={cn('flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink', collapsed && 'justify-center')}
        aria-label={collapsed ? t('expand') : t('collapse')}
      >
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        {!collapsed ? t('collapse') : null}
      </button>
    </aside>
  );
}
