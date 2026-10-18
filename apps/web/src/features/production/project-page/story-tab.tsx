'use client';

import { ListPlus, Loader2, Palette, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { DesignProgress, DesignTarget, OUTLINE_MAX_CHARS, type AgentJob, type DramaDetail, type DramaJobs } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/input';
import { useToastError } from '@/lib/errors';
import { useServerDraft } from '@/lib/use-server-draft';
import { textOverride, useModelPicks } from '../../configuration/model-picks';
import { useStartDesign, useStartOutline, useUpdateDrama } from '../api';
import { CancelJobButton } from '../cancel-job-button';

/**
 * The Story tab (adr-0015): the outline, edited by hand or written by the story writer, and the way into the episode
 * plan and the designed assets (adr-0024). The editor follows the server's outline until the creator types; a
 * running outline job locks it.
 */
export function StoryTab({
  drama,
  jobs,
  onPlan,
  onShowAssets,
}: {
  drama: DramaDetail;
  jobs: DramaJobs | undefined;
  onPlan: () => void;
  onShowAssets: () => void;
}) {
  const t = useTranslations('project.story');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const { picks } = useModelPicks();
  const start = useStartOutline(drama.id);
  const startDesign = useStartDesign(drama.id);
  const update = useUpdateDrama();
  const [draft, setDraft, dirty] = useServerDraft(drama.outline);
  const [confirm, setConfirm] = useState(false);
  const [designConfirm, setDesignConfirm] = useState(false);

  const outlineJob = jobs?.outline ?? null;
  const running = outlineJob?.status === 'running';
  const planRunning = jobs?.plan?.status === 'running';
  const designRunning = !!jobs && Object.values(jobs.design).some((j) => j?.status === 'running');
  const failed = !running && outlineJob?.status === 'failed' ? (outlineJob.error ?? '') : null;
  const hasOutline = drama.outline.trim().length > 0;

  const run = async () => {
    setConfirm(false);
    try {
      // Over an existing outline the click came through the dialog, so it carries replace (adr-0016).
      await start.mutateAsync({ ...textOverride(picks), replace: hasOutline });
      // The new outline replaces the draft too; a stale unsaved draft on top of it would be saved over the result.
      setDraft(drama.outline);
    } catch (err) {
      toastError(err);
    }
  };
  const save = async () => {
    try {
      await update.mutateAsync({ id: drama.id, outline: draft });
      toast.success(t('saved'));
    } catch (err) {
      toastError(err);
    }
  };
  // One job per kind, the three started together (adr-0024); a kind already running is returned, not started twice.
  // Each start is its own request, so one refusal is reported once and the others still run.
  const design = async () => {
    setDesignConfirm(false);
    const started = await startDesign.mutateAsync(textOverride(picks));
    const failures = started.filter((r) => r.status === 'rejected');
    if (failures.length === 0) return;
    const text = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));
    const distinct = failures.filter((f, i) => failures.findIndex((g) => text(g.reason) === text(f.reason)) === i);
    for (const f of distinct) toastError(f.reason);
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="story-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="story-title" className="font-display text-3xl font-semibold tracking-wide">
          {t('title')}
        </h2>
        <span className="text-xs text-muted tabular-nums">{t('chars', { count: draft.length, max: OUTLINE_MAX_CHARS })}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={save} loading={update.isPending} disabled={!dirty || running || planRunning}>
            {tc('save')}
          </Button>
          <Button
            size="sm"
            variant={hasOutline ? 'quiet' : 'primary'}
            onClick={() => (hasOutline || dirty ? setConfirm(true) : void run())}
            loading={start.isPending}
            disabled={running}
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {hasOutline ? t('rewrite') : t('write')}
          </Button>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setDesignConfirm(true)}
            loading={startDesign.isPending}
            disabled={!hasOutline || dirty || running || designRunning}
            title={!hasOutline ? t('designNeedsOutline') : dirty ? t('designSaveFirst') : undefined}
          >
            <Palette className="h-3.5 w-3.5" aria-hidden />
            {t('design')}
          </Button>
          <Button size="sm" variant={hasOutline ? 'primary' : 'secondary'} onClick={onPlan} disabled={running || planRunning}>
            <ListPlus className="h-3.5 w-3.5" aria-hidden />
            {t('plan')}
          </Button>
        </div>
      </div>
      <p className="max-w-2xl text-sm text-ink-2">{t('hint')}</p>
      {running ? (
        <div className="flex items-center gap-2">
          <p className="flex items-center gap-2 text-sm text-ink-2" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
            {t('running')}
          </p>
          <CancelJobButton job={outlineJob} owner={{ dramaId: drama.id }} />
        </div>
      ) : null}
      {failed !== null ? (
        <p className="flex max-w-2xl items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t('failed', { error: failed })}</span>
        </p>
      ) : null}
      {jobs ? <DesignStatus drama={drama} jobs={jobs.design} onShowAssets={onShowAssets} /> : null}
      <Textarea
        aria-label={t('title')}
        value={draft}
        maxLength={OUTLINE_MAX_CHARS}
        disabled={running}
        placeholder={t('placeholder')}
        onChange={(e) => setDraft(e.target.value)}
        className="min-h-[60dvh] font-mono text-sm leading-relaxed"
      />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={hasOutline ? t('rewriteTitle') : t('writeTitle')}
        description={hasOutline ? t('rewriteBody') : t('writeBody')}
        confirmLabel={hasOutline ? t('rewrite') : t('write')}
        onConfirm={run}
        pending={start.isPending}
      />
      <ConfirmDialog
        open={designConfirm}
        onOpenChange={setDesignConfirm}
        title={t('designTitle')}
        description={t('designBody')}
        confirmLabel={t('design')}
        onConfirm={design}
        pending={startDesign.isPending}
      />
    </section>
  );
}

/**
 * The latest design job of each kind (adr-0024): running with its cancel, failed, cancelled, or done with what the
 * save counted; and one note when the outline moved on after a design, against the revision the run recorded.
 */
function DesignStatus({ drama, jobs, onShowAssets }: { drama: DramaDetail; jobs: DramaJobs['design']; onShowAssets: () => void }) {
  const t = useTranslations('project.story');
  const lines = DesignTarget.options.map((target) => ({ target, job: jobs[target] })).filter((l): l is { target: DesignTarget; job: AgentJob } => l.job !== null);
  if (lines.length === 0) return null;
  const stale = lines.some(({ job }) => {
    const revision = job.status === 'done' ? DesignProgress.safeParse(job.progress).data?.outlineRevision : undefined;
    return revision !== undefined && revision < drama.outlineRevision;
  });
  const anyDone = lines.some(({ job }) => job.status === 'done');
  return (
    <div className="flex max-w-2xl flex-col gap-1.5 text-sm">
      {lines.map(({ target, job }) => (
        <DesignLine key={target} drama={drama} target={target} job={job} />
      ))}
      {stale ? <p className="text-muted">{t('designStale')}</p> : null}
      {anyDone ? (
        <button type="button" onClick={onShowAssets} className="self-start text-sm text-accent underline-offset-2 hover:underline">
          {t('designOpenAssets')}
        </button>
      ) : null}
    </div>
  );
}

function DesignLine({ drama, target, job }: { drama: DramaDetail; target: DesignTarget; job: AgentJob }) {
  const t = useTranslations('project.story');
  const label = t(`targets.${target}`);
  if (job.status === 'running') {
    return (
      <div className="flex items-center gap-2">
        <p className="flex items-center gap-2 text-ink-2" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
          {t('designRunning', { target: label })}
        </p>
        <CancelJobButton job={job} owner={{ dramaId: drama.id }} />
      </div>
    );
  }
  if (job.status === 'failed') {
    return (
      <p className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-danger" role="alert">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{t('designFailed', { target: label, error: job.error ?? '' })}</span>
      </p>
    );
  }
  if (job.status === 'cancelled') return <p className="text-muted">{t('designCancelled', { target: label })}</p>;
  const progress = DesignProgress.safeParse(job.progress).data ?? {};
  const skipped = progress.skipped ?? [];
  const overflow = progress.overflow ?? [];
  return (
    <p className="text-ink-2">
      {t('designDone', { target: label, saved: progress.saved ?? 0, filled: progress.filled ?? 0 })}
      {skipped.length > 0 ? ` ${t('designSkipped', { names: skipped.join(', ') })}` : ''}
      {overflow.length > 0 ? ` ${t('designOverflow', { names: overflow.join(', ') })}` : ''}
    </p>
  );
}
