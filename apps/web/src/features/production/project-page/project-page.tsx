'use client';

import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { FrameCover } from '@/components/frame-cover';
import { StatusMenu } from '@/components/status-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useToastError } from '@/lib/errors';
import { AssetLibrary } from '../../assets/asset-library';
import { useStylePresets } from '../../configuration/api';
import { useDramaDetail, useDramaJobs, useUpdateDrama } from '../api';
import { EditProjectDialog } from './edit-project-dialog';
import { AddEpisodeDialog, EpisodesTab } from './episodes-tab';
import { PlanEpisodesDialog } from './plan-episodes-dialog';
import { StoryTab } from './story-tab';

const TABS = ['episodes', 'story', 'assets'] as const;
type Tab = (typeof TABS)[number];

export function ProjectPage({ dramaId }: { dramaId: number }) {
  const t = useTranslations('project');
  const toastError = useToastError();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = TABS.find((k) => k === requested) ?? 'episodes';
  const showTab = (key: Tab) => router.replace(key === 'episodes' ? pathname : `${pathname}?tab=${key}`, { scroll: false });
  const detail = useDramaDetail(dramaId);
  const jobs = useDramaJobs(dramaId);
  const presets = useStylePresets(true);
  const update = useUpdateDrama();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [planning, setPlanning] = useState(false);

  if (detail.isLoading) return <Skeleton className="h-40" />;
  if (detail.isError || !detail.data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-ink-2">{t('notFound')}</p>
        <Link href="/" className="text-sm font-medium text-accent-soft-ink hover:underline">
          {t('back')}
        </Link>
      </div>
    );
  }
  const drama = detail.data;
  const styleName = presets.data?.find((p) => p.value === drama.style)?.name ?? drama.style;

  return (
    <div className="flex flex-col gap-8">
      <Link href="/" className="inline-flex items-center gap-1.5 self-start text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t('back')}
      </Link>
      <header className="flex flex-wrap items-center gap-5">
        <FrameCover aspectRatio={drama.aspectRatio} title={drama.title} seed={drama.id} thumbnail={drama.thumbnail} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="truncate font-display text-5xl leading-none font-bold tracking-wide">{drama.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <StatusMenu
              value={drama.status}
              onChange={(status) => update.mutate({ id: drama.id, status }, { onError: (err) => toastError(err) })}
            />
            <span>{styleName}</span>
            <span className="text-muted">{t('aspect', { ratio: drama.aspectRatio })}</span>
          </div>
          <p className="text-sm text-muted">
            {t('counts', {
              episodes: drama.episodes.length,
              characters: drama.counts.characters,
              scenes: drama.counts.scenes,
              props: drama.counts.props,
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" aria-hidden />
            {t('edit.open')}
          </Button>
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('addEpisode')}
          </Button>
        </div>
      </header>

      <div className="flex gap-6 border-b border-line" role="tablist">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => showTab(key)}
            className={cn(
              '-mb-px border-b-2 pb-3 text-sm font-medium transition-colors',
              tab === key ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink',
            )}
          >
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>

      {tab === 'episodes' ? <EpisodesTab drama={drama} jobs={jobs.data} onAdd={() => setAdding(true)} /> : null}
      {tab === 'story' ? <StoryTab drama={drama} jobs={jobs.data} onPlan={() => setPlanning(true)} /> : null}
      {tab === 'assets' ? <AssetLibrary dramaId={drama.id} episodeId={drama.episodes[0]?.id} /> : null}
      {adding ? <AddEpisodeDialog drama={drama} onClose={() => setAdding(false)} /> : null}
      {planning ? (
        <PlanEpisodesDialog
          drama={drama}
          onClose={() => setPlanning(false)}
          onStarted={() => {
            setPlanning(false);
            showTab('episodes');
          }}
        />
      ) : null}
      {editing ? <EditProjectDialog drama={drama} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
