'use client';

import { Loader2, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { EpisodeView } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/input';
import { useToastError } from '@/lib/errors';
import { textOverride, useModelPicks } from '../../configuration/model-picks';
import { useEpisodeJobs, useSkipRewrite, useStartRewrite, useUpdateEpisode } from '../api';

/** An editable copy of a server field that follows server changes but never drops text typed during a save. */
function useDraft(serverValue: string) {
  const [draft, setDraft] = useState(serverValue);
  const [base, setBase] = useState(serverValue);
  if (base !== serverValue) {
    setBase(serverValue);
    if (draft === base) setDraft(serverValue);
  }
  return [draft, setDraft, draft !== serverValue] as const;
}

export function RawContentPanel({ episode, onNext }: { episode: EpisodeView; onNext: () => void }) {
  const t = useTranslations('studio.script');
  const toastError = useToastError();
  const update = useUpdateEpisode();
  const [draft, setDraft, dirty] = useDraft(episode.content);

  const save = async () => {
    try {
      await update.mutateAsync({ id: episode.id, content: draft });
      toast.success(t('saved'));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <section className="mx-auto flex h-full max-w-4xl flex-col gap-3" aria-labelledby="raw-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="raw-title" className="font-display text-3xl font-semibold tracking-wide">
          {t('raw')}
        </h2>
        <span className="text-xs text-muted tabular-nums">{t('chars', { count: draft.length })}</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={save} loading={update.isPending} disabled={!dirty}>
            {t('save')}
          </Button>
          <Button size="sm" variant="quiet" onClick={onNext} disabled={dirty || !episode.content.trim()}>
            {t('toRewrite')}
          </Button>
        </div>
      </div>
      <p className="text-sm text-ink-2">{t('rawHint')}</p>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('rawPlaceholder')}
        className="min-h-[60dvh] flex-1 text-[15px]"
        aria-labelledby="raw-title"
      />
    </section>
  );
}

export function RewritePanel({ episode, onRaw }: { episode: EpisodeView; onRaw: () => void }) {
  const t = useTranslations('studio.script');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const { picks } = useModelPicks();
  const jobs = useEpisodeJobs(episode.id);
  const start = useStartRewrite(episode.id);
  const skip = useSkipRewrite();
  const update = useUpdateEpisode();
  const [draft, setDraft, dirty] = useDraft(episode.scriptContent ?? '');
  const [confirmAgain, setConfirmAgain] = useState(false);

  const job = jobs.data?.rewrite ?? null;
  const running = job?.status === 'running';
  const hasScript = !!episode.scriptContent?.trim();
  const failedLast = job?.status === 'failed' && !running;

  const rewrite = async () => {
    setConfirmAgain(false);
    try {
      await start.mutateAsync(textOverride(picks));
    } catch (err) {
      toastError(err);
    }
  };
  const doSkip = async () => {
    try {
      await skip.mutateAsync(episode.id);
    } catch (err) {
      toastError(err);
    }
  };
  const save = async () => {
    try {
      await update.mutateAsync({ id: episode.id, scriptContent: draft });
      toast.success(t('saved'));
    } catch (err) {
      toastError(err);
    }
  };

  if (!episode.content.trim()) {
    return (
      <Empty title={t('rewriteTitle')} body={t('needRaw')}>
        <Button onClick={onRaw}>{t('toRaw')}</Button>
      </Empty>
    );
  }

  if (running) {
    return (
      <Empty title={t('rewriteTitle')} body={t('running')}>
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-label={t('running')} />
      </Empty>
    );
  }

  if (!hasScript) {
    return (
      <Empty title={t('rewriteTitle')} body={failedLast ? undefined : t('rewriteBody')}>
        {failedLast ? (
          <p className="flex max-w-lg items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t('failed', { error: job?.error ?? '' })}</span>
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button variant="primary" onClick={rewrite} loading={start.isPending}>
            {failedLast ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {failedLast ? tc('retry') : t('start')}
          </Button>
          <Button onClick={doSkip} loading={skip.isPending}>
            {t('skip')}
          </Button>
        </div>
      </Empty>
    );
  }

  return (
    <section className="mx-auto flex h-full max-w-4xl flex-col gap-3" aria-labelledby="script-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="script-title" className="font-display text-3xl font-semibold tracking-wide">
          {t('script')}
        </h2>
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={save} loading={update.isPending} disabled={!dirty}>
            {t('save')}
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setConfirmAgain(true)} loading={start.isPending}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t('again')}
          </Button>
        </div>
      </div>
      {failedLast ? (
        <p className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t('failedKept', { error: job?.error ?? '' })}</span>
        </p>
      ) : null}
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[60dvh] flex-1 font-mono text-[14px] leading-relaxed"
        aria-labelledby="script-title"
      />
      <ConfirmDialog
        open={confirmAgain}
        onOpenChange={setConfirmAgain}
        title={t('againTitle')}
        description={t('againBody')}
        confirmLabel={t('again')}
        onConfirm={rewrite}
        danger={false}
      />
    </section>
  );
}

function Empty({ title, body, children }: { title: string; body?: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-start gap-4 pt-10">
      <h2 className="font-display text-3xl font-semibold tracking-wide">{title}</h2>
      {body ? <p className="max-w-lg text-ink-2">{body}</p> : null}
      {children}
    </section>
  );
}
