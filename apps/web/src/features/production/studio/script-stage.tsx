'use client';

import { Loader2, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { RECAP_MAX_CHARS, type DramaDetail, type EpisodeJobs, type EpisodeView } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/input';
import { useToastError } from '@/lib/errors';
import { useServerDraft } from '@/lib/use-server-draft';
import { textOverride, useModelPicks } from '../../configuration/model-picks';
import { useEpisodeJobs, useSkipRewrite, useStartRecap, useStartRewrite, useStartWrite, useUpdateEpisode } from '../api';
import { EarlierRecaps } from '../earlier-recaps';

export function RawContentPanel({ episode, onNext }: { episode: EpisodeView; onNext: () => void }) {
  const t = useTranslations('studio.script');
  const toastError = useToastError();
  const update = useUpdateEpisode();
  const [draft, setDraft, dirty] = useServerDraft(episode.content);

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

/** How many of the earlier episodes' recaps the agents will get: the studio names the gaps before a rewrite. */
type ScriptAgent = 'rewrite' | 'write';

/**
 * The script stage: the rewriter turns raw content into the script, the episode writer expands a beat sheet into
 * one (adr-0015). The script has one agent at a time, so one running state covers both and the API refuses the other.
 */
export function RewritePanel({ episode, drama, onRaw }: { episode: EpisodeView; drama: DramaDetail; onRaw: () => void }) {
  const t = useTranslations('studio.script');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const { picks } = useModelPicks();
  const jobs = useEpisodeJobs(episode.id);
  const start = { rewrite: useStartRewrite(episode.id), write: useStartWrite(episode.id) };
  const skip = useSkipRewrite();
  const update = useUpdateEpisode();
  const [draft, setDraft, dirty] = useServerDraft(episode.scriptContent ?? '');
  const [confirm, setConfirm] = useState<ScriptAgent | null>(null);

  const agentJobs = { rewrite: jobs.data?.rewrite ?? null, write: jobs.data?.write ?? null };
  const running = (['rewrite', 'write'] as const).find((k) => agentJobs[k]?.status === 'running') ?? null;
  // The more recent of the two jobs is the one whose failure is worth showing.
  const latest = (['rewrite', 'write'] as const)
    .filter((k) => agentJobs[k])
    .sort((a, b) => agentJobs[b]!.id - agentJobs[a]!.id)[0];
  const failedLast = latest !== undefined && agentJobs[latest]?.status === 'failed' && !running ? latest : null;
  const failedError = failedLast ? (agentJobs[failedLast]?.error ?? '') : '';
  const hasScript = !!episode.scriptContent?.trim();

  const run = async (kind: ScriptAgent) => {
    setConfirm(null);
    try {
      await start[kind].mutateAsync(textOverride(picks));
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
    const body = running === 'write' ? t('expanding') : t('running');
    return (
      <Empty title={t('rewriteTitle')} body={body}>
        <Loader2 className="h-6 w-6 animate-spin text-accent" aria-label={body} />
      </Empty>
    );
  }

  if (!hasScript) {
    return (
      <Empty title={t('rewriteTitle')} body={failedLast ? undefined : t('rewriteBody')}>
        <EarlierRecaps drama={drama} before={episode.episodeNumber} />
        {failedLast ? (
          <p className="flex max-w-lg items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{failedLast === 'write' ? t('expandFailed', { error: failedError }) : t('failed', { error: failedError })}</span>
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => run('rewrite')} loading={start.rewrite.isPending}>
            {failedLast === 'rewrite' ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {failedLast === 'rewrite' ? tc('retry') : t('start')}
          </Button>
          <Button onClick={() => run('write')} loading={start.write.isPending}>
            {failedLast === 'write' ? <RotateCcw className="h-4 w-4" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
            {failedLast === 'write' ? tc('retry') : t('expand')}
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
          <Button size="sm" variant="quiet" onClick={() => setConfirm('rewrite')} loading={start.rewrite.isPending}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t('again')}
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setConfirm('write')} loading={start.write.isPending}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t('expandAgain')}
          </Button>
        </div>
      </div>
      {failedLast ? (
        <p className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{failedLast === 'write' ? t('expandFailedKept', { error: failedError }) : t('failedKept', { error: failedError })}</span>
        </p>
      ) : null}
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[60dvh] flex-1 font-mono text-[14px] leading-relaxed"
        aria-labelledby="script-title"
      />
      {drama.serial ? <RecapCard episode={episode} jobs={jobs.data} /> : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'write' ? t('expandAgainTitle') : t('againTitle')}
        description={confirm === 'write' ? t('expandAgainBody') : t('againBody')}
        confirmLabel={confirm === 'write' ? t('expandAgain') : t('again')}
        onConfirm={() => confirm && run(confirm)}
        danger={false}
      />
    </section>
  );
}

/**
 * The episode's recap for the writers of the next episodes (adr-0014): written by the recap writer after every saved
 * script, editable by the creator. While the job runs the editor is replaced (and the API refuses recap edits), so
 * an edit cannot race the save. A failed job matters only while the episode has no fresh recap.
 */
function RecapCard({ episode, jobs }: { episode: EpisodeView; jobs: EpisodeJobs | undefined }) {
  const t = useTranslations('studio.script.recap');
  const toastError = useToastError();
  const { picks } = useModelPicks();
  const start = useStartRecap(episode.id);
  const update = useUpdateEpisode();
  const [draft, setDraft, dirty] = useServerDraft(episode.recap);
  const job = jobs?.recap ?? null;
  const running = job?.status === 'running';
  const hasRecap = episode.recap.trim().length > 0;
  const failed = job?.status === 'failed' && (!hasRecap || episode.recapStale);

  const write = async () => {
    try {
      await start.mutateAsync(textOverride(picks));
    } catch (err) {
      toastError(err);
    }
  };
  const save = async () => {
    try {
      await update.mutateAsync({ id: episode.id, recap: draft });
      toast.success(t('saved'));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2/40 p-4" aria-labelledby="recap-title">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="recap-title" className="font-display text-xl font-semibold tracking-wide">
          {t('title')}
        </h3>
        <span className="text-xs text-muted">{t('hint')}</span>
        <div className="ml-auto flex gap-2">
          {!running ? (
            <Button size="sm" onClick={save} loading={update.isPending} disabled={!dirty || start.isPending}>
              {t('save')}
            </Button>
          ) : null}
          <Button size="sm" variant="quiet" onClick={write} loading={start.isPending} disabled={running}>
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {hasRecap ? t('rewrite') : t('write')}
          </Button>
        </div>
      </div>
      {failed && !running ? (
        <p className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t('failed', { error: job?.error ?? '' })}</span>
        </p>
      ) : null}
      {episode.recapStale && !running ? (
        <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning" role="status">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t('stale')}</span>
        </p>
      ) : null}
      {running ? (
        <p className="flex items-center gap-2 py-6 text-sm text-ink-2">
          <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden />
          {t('running')}
        </p>
      ) : (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={RECAP_MAX_CHARS}
          placeholder={t('placeholder')}
          className="min-h-32 text-[14px]"
          aria-labelledby="recap-title"
        />
      )}
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
