'use client';

import { Dialog as D } from 'radix-ui';
import { ListChecks, Loader2, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { EpisodeTaskRow, Film, TaskStatus } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { relativeTime } from '@/lib/time';
import { useEpisodeTasks } from './api';

const STATUS_TONE = { processing: 'info', completed: 'success', failed: 'danger' } as const;

type Row = { kind: 'task'; at: string; task: EpisodeTaskRow } | { kind: 'film'; at: string; film: Film };

/** "42 s" / "3 min, 5 s" between two timestamps (now for work still running), in the UI locale's units. */
function elapsed(from: string, to: string | null, locale: string) {
  const s = Math.max(0, Math.round(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 1000));
  const unit = (value: number, u: 'second' | 'minute') =>
    new Intl.NumberFormat(locale, { style: 'unit', unit: u, unitDisplay: 'short' }).format(value);
  return s < 60 ? unit(s, 'second') : new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format([unit(Math.floor(s / 60), 'minute'), unit(s % 60, 'second')]);
}

function StatusPill({ status }: { status: TaskStatus }) {
  const t = useTranslations('studio.tasks');
  return (
    <Tag tone={STATUS_TONE[status]} className="h-5 px-2">
      {status === 'processing' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
      {t(`status.${status}`)}
    </Tag>
  );
}

function TaskItem({ row }: { row: Row }) {
  const t = useTranslations('studio.tasks');
  const te = useTranslations('errors');
  const locale = useLocale();
  if (row.kind === 'film') {
    const f = row.film;
    return (
      <li className="flex flex-col gap-1 border-b border-line px-4 py-3 text-[13px]">
        <div className="flex items-center gap-2">
          <Tag tone="accent" className="h-5 px-2">
            {t('kind.merge')}
          </Tag>
          <span className="min-w-0 flex-1 truncate font-medium">{t('mergeTarget', { count: f.clipCount })}</span>
          <StatusPill status={f.status} />
        </div>
        <div className="flex gap-2 text-xs text-muted">
          <span>FFmpeg</span>
          <span className="ml-auto tabular-nums">{elapsed(f.createdAt, f.completedAt, locale)}</span>
          <span>{relativeTime(f.createdAt, locale)}</span>
        </div>
        {f.status === 'failed' && f.error ? <p className="line-clamp-3 text-xs text-danger">{f.error}</p> : null}
      </li>
    );
  }
  const task = row.task;
  const owner = task.owner;
  return (
    <li className="flex flex-col gap-1 border-b border-line px-4 py-3 text-[13px]">
      <div className="flex items-center gap-2">
        <Tag tone={task.type === 'video' ? 'info' : 'neutral'} className="h-5 px-2">
          {t(`kind.${task.type}`)}
        </Tag>
        <span className="min-w-0 flex-1 truncate font-medium">
          {owner ? t(`owner.${owner.kind}`, { label: owner.label }) : t('owner.removed')}
        </span>
        <StatusPill status={task.status} />
      </div>
      <div className="flex gap-2 text-xs text-muted">
        <span className="min-w-0 truncate">
          {task.provider} · {task.model}
        </span>
        <span className="ml-auto shrink-0 tabular-nums">{elapsed(task.createdAt, task.completedAt, locale)}</span>
        <span className="shrink-0">{relativeTime(task.createdAt, locale)}</span>
      </div>
      {task.status === 'failed' && task.error ? (
        <p className="text-xs text-danger">
          {task.errorClass && task.errorClass !== 'provider' ? `${te(task.errorClass)} ` : ''}
          <span className="line-clamp-3">{task.error}</span>
        </p>
      ) : null}
    </li>
  );
}

/**
 * Task drawer (Plan 3 §4.5): the episode's image and video tasks and its merges, newest first, capped by the server
 * (50 tasks, 20 merges). The trigger's badge counts the running ones.
 */
export function TaskDrawer({ episodeId }: { episodeId: number }) {
  const t = useTranslations('studio.tasks');
  const [open, setOpen] = useState(false);
  const query = useEpisodeTasks(episodeId);
  const d = query.data;
  const rows: Row[] = d
    ? [
        ...d.tasks.map((task) => ({ kind: 'task' as const, at: task.createdAt, task })),
        ...d.films.map((film) => ({ kind: 'film' as const, at: film.createdAt, film })),
      ].sort((a, b) => b.at.localeCompare(a.at))
    : [];
  const statuses = d ? [...d.tasks.map((x) => x.status), ...d.films.map((x) => x.status)] : [];
  const count = (s: TaskStatus) => statuses.filter((x) => x === s).length;

  return (
    <D.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void query.refetch();
      }}
    >
      <Tooltip content={t('open')}>
        <D.Trigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="relative"
            aria-label={query.active > 0 ? t('openActive', { count: query.active }) : t('open')}
            data-tour="studio-tasks"
          >
            <ListChecks className="h-4 w-4" />
            {query.active > 0 ? (
              <span
                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white tabular-nums"
                aria-hidden
              >
                {query.active}
              </span>
            ) : null}
          </Button>
        </D.Trigger>
      </Tooltip>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <D.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(440px,100vw)] flex-col border-l border-line bg-surface shadow-lg focus:outline-none">
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 pt-4 pb-3">
            <div className="flex flex-col gap-1.5">
              <D.Title className="font-display text-2xl leading-tight font-semibold tracking-wide">{t('title')}</D.Title>
              <D.Description className="flex flex-wrap gap-1.5">
                <Tag tone="info">{t('count.processing', { count: count('processing') })}</Tag>
                <Tag tone="success">{t('count.completed', { count: count('completed') })}</Tag>
                <Tag tone="danger">{t('count.failed', { count: count('failed') })}</Tag>
              </D.Description>
            </div>
            <D.Close className="-mr-1 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink" aria-label={t('close')}>
              <X className="h-4 w-4" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {query.isLoading ? <Skeleton className="m-4 h-40" /> : null}
            {d && rows.length === 0 ? <p className="p-4 text-sm text-muted">{t('empty')}</p> : null}
            <ul>
              {rows.map((row) => (
                <TaskItem key={row.kind === 'task' ? `t${row.task.id}` : `f${row.film.id}`} row={row} />
              ))}
            </ul>
            {d && rows.length > 0 ? <p className="px-4 py-3 text-xs text-muted">{t('cap', { tasks: 50, films: 20 })}</p> : null}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
