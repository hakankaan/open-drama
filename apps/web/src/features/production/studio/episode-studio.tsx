'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronDown, CircleHelp, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { Resolution as ResolutionEnum, type DramaDetail, type EpisodePipelineStatus, type EpisodeView } from '@open-drama/contracts';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { useTour } from '@/components/tour';
import { ModelSelect } from '@/components/model-select';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { useToastError } from '@/lib/errors';
import { usePersistedState } from '@/lib/persisted-state';
import { AssetsStage } from '../../assets/assets-stage';
import { ExportStage } from '../../compositing/export-stage';
import { TaskDrawer } from '../../generation/task-drawer';
import { VideoStage } from '../../storyboard/video-stage/video-stage';
import { useVideoTarget } from '../../storyboard/use-video-target';
import { useModelPicks } from '../../configuration/model-picks';
import { useDramaDetail, useEpisode, usePipelineStatus, useUpdateEpisode } from '../api';
import { useSettleRefresh } from '../use-settle-refresh';
import { RawContentPanel, RewritePanel } from './script-stage';
import { StudioSidebar, deriveStages, type Panel } from './sidebar';

/** The first step that still needs work, used when the episode has no remembered panel. */
function firstOpenPanel(p: EpisodePipelineStatus | undefined): Panel {
  const s = deriveStages(p);
  if (!s.raw) return 'raw';
  if (!s.script) return 'rewrite';
  return 'assets';
}

function TopBar({
  dramaTitle,
  dramaId,
  episode,
  stage,
  onHelp,
}: {
  dramaTitle: string;
  dramaId: number;
  episode: EpisodeView;
  stage: string;
  onHelp: () => void;
}) {
  const t = useTranslations('studio');
  const qc = useQueryClient();
  const toastError = useToastError();
  const update = useUpdateEpisode();
  const { picks, setPick } = useModelPicks();
  // The tiers the selected (or locked) video provider offers; the stored one stays listed so it can be seen.
  const { caps } = useVideoTarget(episode, picks);
  const tiers = ResolutionEnum.options.filter((r) => caps.resolutions.includes(r) || r === episode.resolution);
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <Link
        href={`/drama/${dramaId}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink"
        aria-label={t('backToProject')}
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <span className="max-w-56 truncate font-display text-xl font-semibold tracking-wide">{dramaTitle}</span>
      <Tag tone="accent">{t('episodeChip', { number: episode.episodeNumber })}</Tag>
      <span className="hidden truncate text-sm text-ink-2 lg:inline">{stage}</span>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 xl:flex" data-tour="studio-models">
          <ModelSelect type="text" value={picks.text} onChange={(p) => setPick('text', p)} className="w-44" />
          <ModelSelect type="image" value={picks.image} onChange={(p) => setPick('image', p)} className="w-44" />
          <ModelSelect type="video" value={picks.video} onChange={(p) => setPick('video', p)} className="w-44" />
        </div>
        <Menu>
          <MenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('resolution', { resolution: episode.resolution })}
              data-tour="studio-resolution"
            >
              <span className="font-mono text-xs">{episode.resolution}</span>
              <ChevronDown className="h-3 w-3" aria-hidden />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {tiers.map((r) => (
              <MenuItem
                key={r}
                checked={r === episode.resolution}
                onSelect={() =>
                  r !== episode.resolution && update.mutate({ id: episode.id, resolution: r }, { onError: (err) => toastError(err) })
                }
              >
                {r}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
        <TaskDrawer episodeId={episode.id} />
        <Tooltip content={t('help')}>
          <Button size="icon" variant="ghost" onClick={onHelp} aria-label={t('help')}>
            <CircleHelp className="h-4 w-4" />
          </Button>
        </Tooltip>
        <Tooltip content={t('refresh')}>
          <Button size="icon" variant="ghost" onClick={() => void qc.invalidateQueries()} aria-label={t('refresh')}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </Tooltip>
        <ThemeToggle />
        <LocaleSwitcher />
      </div>
    </header>
  );
}

/** The loaded studio: one owner for the current panel, shared by the top bar and the sidebar. */
function StudioBody({ drama, episode }: { drama: DramaDetail; episode: EpisodeView }) {
  const t = useTranslations('studio');
  const dramaId = drama.id;
  const pipeline = usePipelineStatus(episode.id);
  useSettleRefresh(episode.id, dramaId);
  const [stored, setPanel, loaded] = usePersistedState<Panel | null>(`studio-panel:${episode.id}`, null);
  const [collapsed, setCollapsed] = usePersistedState('studio-sidebar-collapsed', false);
  // The creator's step is kept across refreshes; an episode without a remembered step opens on the first open one.
  const panel: Panel = stored ?? firstOpenPanel(pipeline.data);
  // Runs once the sidebar has rendered, since the first step points at it.
  const tourSteps = useMemo(
    () => [
      { target: 'studio-stages', title: t('tour.stagesTitle'), description: t('tour.stagesBody') },
      { target: 'studio-models', title: t('tour.modelsTitle'), description: t('tour.modelsBody') },
      { target: 'studio-resolution', title: t('tour.resolutionTitle'), description: t('tour.resolutionBody') },
      { target: 'studio-tasks', title: t('tour.tasksTitle'), description: t('tour.tasksBody') },
    ],
    [t],
  );
  const replayTour = useTour('studio', tourSteps, loaded);
  // Pin the first computed step, so saving data never moves the creator to another panel.
  useEffect(() => {
    if (loaded && stored === null && pipeline.data) setPanel(firstOpenPanel(pipeline.data));
  }, [loaded, stored, pipeline.data, setPanel]);

  return (
    <div className="flex h-dvh flex-col">
      <TopBar dramaTitle={drama.title} dramaId={dramaId} episode={episode} stage={t(`panels.${panel}`)} onHelp={replayTour} />
      {!loaded ? (
        <Skeleton className="m-6 h-[70dvh]" />
      ) : (
        <div className="flex min-h-0 flex-1">
          <StudioSidebar panel={panel} onPanel={setPanel} pipeline={pipeline.data} collapsed={collapsed} onCollapse={setCollapsed} />
          <main className="min-w-0 flex-1 overflow-y-auto p-6">
            {panel === 'raw' ? <RawContentPanel episode={episode} onNext={() => setPanel('rewrite')} /> : null}
            {panel === 'rewrite' ? <RewritePanel episode={episode} drama={drama} onRaw={() => setPanel('raw')} /> : null}
            {panel === 'assets' ? <AssetsStage episode={episode} onScript={() => setPanel('rewrite')} /> : null}
            {panel === 'video' ? (
              <VideoStage episode={episode} onScript={() => setPanel('rewrite')} onAssets={() => setPanel('assets')} />
            ) : null}
            {panel === 'export' ? <ExportStage episode={episode} onVideo={() => setPanel('video')} /> : null}
          </main>
        </div>
      )}
    </div>
  );
}

export function EpisodeStudio({ dramaId, episodeNumber }: { dramaId: number; episodeNumber: number }) {
  const t = useTranslations('studio');
  const drama = useDramaDetail(dramaId);
  const summary = drama.data?.episodes.find((e) => e.episodeNumber === episodeNumber);
  const episode = useEpisode(summary?.id);

  if (drama.isLoading || (summary && episode.isLoading)) return <Skeleton className="m-6 h-[70dvh]" />;
  if (!drama.data || !summary || !episode.data) {
    return (
      <div className="flex flex-col items-start gap-3 p-8">
        <p className="text-ink-2">{t('notFound')}</p>
        <Link href={`/drama/${dramaId}`} className="text-sm font-medium text-accent-soft-ink hover:underline">
          {t('backToProject')}
        </Link>
      </div>
    );
  }
  return <StudioBody drama={drama.data} episode={episode.data} />;
}
