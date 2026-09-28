'use client';

import { CircleHelp, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { DramaStatus as DramaStatusEnum, type DramaListItem, type DramaStatus } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { useTour } from '@/components/tour';
import { cn } from '@/lib/cn';
import { useToastError } from '@/lib/errors';
import { usePersistedState } from '@/lib/persisted-state';
import { useStylePresets } from '../../configuration/api';
import { useDeleteDrama, useDramaList, useUpdateDrama } from '../api';
import { CreateProjectDialog } from './create-project-dialog';
import { ProjectCard } from './project-card';

type Sort = 'updated' | 'name';

export function Launcher() {
  const t = useTranslations('launcher');
  const ts = useTranslations('status');
  const toastError = useToastError();
  const list = useDramaList();
  const presets = useStylePresets(true);
  const update = useUpdateDrama();
  const remove = useDeleteDrama();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DramaStatus | 'all'>('all');
  const [sort, setSort] = usePersistedState<Sort>('launcher-sort', 'updated');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<DramaListItem | null>(null);

  const styleName = useMemo(() => {
    const map = new Map((presets.data ?? []).map((p) => [p.value, p.name]));
    return (value: string) => map.get(value) ?? value;
  }, [presets.data]);

  const dramas = useMemo(() => list.data?.items ?? [], [list.data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dramas
      .filter((d) => status === 'all' || d.status === status)
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          styleName(d.style).toLowerCase().includes(q) ||
          ts(d.status).toLowerCase().includes(q),
      )
      .sort((a, b) => (sort === 'name' ? a.title.localeCompare(b.title) : b.updatedAt.localeCompare(a.updatedAt)));
  }, [dramas, query, status, sort, styleName, ts]);

  const activeCount = dramas.filter((d) => d.status === 'active').length;

  const tourSteps = useMemo(
    () => [
      { title: t('tour.welcomeTitle'), description: t('tour.welcomeBody') },
      { target: 'nav-settings', title: t('tour.settingsTitle'), description: t('tour.settingsBody') },
      { target: 'new-project', title: t('tour.createTitle'), description: t('tour.createBody') },
    ],
    [t],
  );
  const replayTour = useTour('launcher', tourSteps, !list.isLoading);

  const changeStatus = (drama: DramaListItem, next: DramaStatus) =>
    update.mutate({ id: drama.id, status: next }, { onError: (err) => toastError(err) });

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
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-5xl leading-none font-bold tracking-wide sm:text-6xl">{t('title')}</h1>
          <p className="max-w-xl text-ink-2">{t('subtitle')}</p>
          {list.data ? (
            <p className="text-sm text-muted">
              {t('summary', { projects: dramas.length, active: activeCount, styles: presets.data?.filter((p) => p.isActive).length ?? 0 })}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content={t('help')}>
            <Button variant="ghost" size="icon" onClick={replayTour} aria-label={t('help')}>
              <CircleHelp className="h-[18px] w-[18px]" />
            </Button>
          </Tooltip>
          <Button variant="primary" onClick={() => setCreating(true)} data-tour="new-project">
            <Plus className="h-4 w-4" aria-hidden />
            {t('newProject')}
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            aria-label={t('search')}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1" role="group" aria-label={t('filterLabel')}>
          {(['all', ...DramaStatusEnum.options] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
              className={cn(
                'rounded-full px-3 py-1 text-[13px] font-medium transition-colors',
                status === s ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink',
              )}
            >
              {s === 'all' ? t('all') : ts(s)}
            </button>
          ))}
        </div>
        <div className="ml-auto w-48">
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as Sort)}
            options={[
              { value: 'updated', label: t('sortUpdated') },
              { value: 'name', label: t('sortName') },
            ]}
          />
        </div>
      </div>

      {list.isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-line bg-surface">
              <Skeleton className="h-48 rounded-none" />
              <div className="flex flex-col gap-3 p-4">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <div className="rounded-lg border border-danger/30 bg-danger-soft p-6 text-sm">
          <p className="text-ink">{t('loadError')}</p>
          <Button className="mt-3" size="sm" onClick={() => void list.refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : dramas.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-dashed border-line-strong p-10">
          <h2 className="font-display text-3xl font-semibold tracking-wide">{t('empty.title')}</h2>
          <p className="max-w-md text-ink-2">{t('empty.body')}</p>
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            {t('newProject')}
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-strong p-10">
          <p className="text-ink-2">{t('noMatch')}</p>
          <Button
            size="sm"
            onClick={() => {
              setQuery('');
              setStatus('all');
            }}
          >
            {t('clearFilters')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
          {visible.map((drama) => (
            <ProjectCard
              key={drama.id}
              drama={drama}
              styleName={styleName(drama.style)}
              onStatus={(s) => changeStatus(drama, s)}
              onDelete={() => setDeleting(drama)}
            />
          ))}
        </div>
      )}

      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteTitle', { title: deleting?.title ?? '' })}
        description={t('deleteBody')}
        confirmLabel={t('deleteConfirm')}
        onConfirm={confirmDelete}
        pending={remove.isPending}
      />
    </div>
  );
}
