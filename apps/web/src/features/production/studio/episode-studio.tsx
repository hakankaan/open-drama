'use client';

import { ArrowLeft, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import type { EpisodeView } from '@open-drama/contracts';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from '@/components/ui/tag';
import { useToastError } from '@/lib/errors';
import { useDramaDetail, useEpisode, usePipelineStatus, useSkipRewrite, useUpdateEpisode } from '../api';

/** Raw content with an explicit, awaited Save; the draft resets whenever the saved content changes. */
function ScriptStage({ episode }: { episode: EpisodeView }) {
  const t = useTranslations('studio.script');
  const toastError = useToastError();
  const update = useUpdateEpisode();
  const skip = useSkipRewrite();
  const [draft, setDraft] = useState(episode.content);
  const [base, setBase] = useState(episode.content);
  // Follow server changes, but never overwrite text typed while a save was in flight.
  if (base !== episode.content) {
    setBase(episode.content);
    if (draft === base) setDraft(episode.content);
  }
  const dirty = draft !== episode.content;

  const save = async () => {
    try {
      await update.mutateAsync({ id: episode.id, content: draft });
      toast.success(t('saved'));
    } catch (err) {
      toastError(err);
    }
  };

  const skipRewrite = async () => {
    try {
      if (dirty) await update.mutateAsync({ id: episode.id, content: draft });
      await skip.mutateAsync(episode.id);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3" aria-labelledby="raw-content">
        <div className="flex items-center gap-3">
          <h2 id="raw-content" className="font-display text-2xl font-semibold tracking-wide">
            {t('raw')}
          </h2>
          <span className="text-xs text-muted tabular-nums">{t('chars', { count: draft.length })}</span>
          <Button size="sm" className="ml-auto" onClick={save} loading={update.isPending && !skip.isPending} disabled={!dirty}>
            {t('save')}
          </Button>
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('rawPlaceholder')}
          className="min-h-[55dvh] text-[15px]"
          aria-labelledby="raw-content"
        />
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="script">
        <div className="flex items-center gap-3">
          <h2 id="script" className="font-display text-2xl font-semibold tracking-wide">
            {t('script')}
          </h2>
          {episode.scriptContent ? (
            <Tag tone="success">
              <Check className="h-3 w-3" aria-hidden />
              {t('ready')}
            </Tag>
          ) : null}
        </div>
        {episode.scriptContent ? (
          <pre className="min-h-[55dvh] overflow-auto rounded-md border border-line bg-surface p-4 font-sans text-[15px] leading-relaxed whitespace-pre-wrap">
            {episode.scriptContent}
          </pre>
        ) : (
          <div className="flex min-h-[55dvh] flex-col items-start justify-center gap-3 rounded-md border border-dashed border-line-strong p-6">
            <p className="max-w-sm text-sm text-ink-2">{t('emptyScript')}</p>
            <Button onClick={skipRewrite} loading={skip.isPending} disabled={!draft.trim()}>
              {t('useRaw')}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

export function EpisodeStudio({ dramaId, episodeNumber }: { dramaId: number; episodeNumber: number }) {
  const t = useTranslations('studio');
  const drama = useDramaDetail(dramaId);
  const summary = drama.data?.episodes.find((e) => e.episodeNumber === episodeNumber);
  const episode = useEpisode(summary?.id);
  const pipeline = usePipelineStatus(summary?.id);

  if (drama.isLoading || (summary && episode.isLoading)) {
    return <Skeleton className="m-6 h-[70dvh]" />;
  }
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
  const ep = episode.data;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center gap-3 border-b border-line bg-surface px-4">
        <Link
          href={`/drama/${dramaId}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-surface-2 hover:text-ink"
          aria-label={t('backToProject')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="truncate font-display text-xl font-semibold tracking-wide">{drama.data.title}</span>
        <Tag tone="accent">{t('episodeChip', { number: ep.episodeNumber })}</Tag>
        <span className="truncate text-sm text-ink-2">{ep.title}</span>
        <div className="ml-auto flex items-center gap-2">
          {ep.services.video ? <Tag mono>{ep.services.video.defaultModel ?? ep.services.video.name}</Tag> : null}
          <Tag mono>{ep.resolution}</Tag>
          {pipeline.data?.script.state === 'done' ? <Tag tone="success">{t('scriptDone')}</Tag> : null}
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </header>
      <main className="flex-1 p-6">
        <ScriptStage episode={ep} />
      </main>
    </div>
  );
}
