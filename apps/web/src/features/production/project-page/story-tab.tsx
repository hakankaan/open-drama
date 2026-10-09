'use client';

import { ListPlus, Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { OUTLINE_MAX_CHARS, type DramaDetail, type DramaJobs } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Textarea } from '@/components/ui/input';
import { useToastError } from '@/lib/errors';
import { useServerDraft } from '@/lib/use-server-draft';
import { textOverride, useModelPicks } from '../../configuration/model-picks';
import { useStartOutline, useUpdateDrama } from '../api';

/**
 * The Story tab (adr-0015): the outline, edited by hand or written by the story writer, and the way into the episode
 * plan. The editor follows the server's outline until the creator types; a running outline job locks it.
 */
export function StoryTab({ drama, jobs, onPlan }: { drama: DramaDetail; jobs: DramaJobs | undefined; onPlan: () => void }) {
  const t = useTranslations('project.story');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const { picks } = useModelPicks();
  const start = useStartOutline(drama.id);
  const update = useUpdateDrama();
  const [draft, setDraft, dirty] = useServerDraft(drama.outline);
  const [confirm, setConfirm] = useState(false);

  const outlineJob = jobs?.outline ?? null;
  const running = outlineJob?.status === 'running';
  const planRunning = jobs?.plan?.status === 'running';
  const failed = !running && outlineJob?.status === 'failed' ? (outlineJob.error ?? '') : null;
  const hasOutline = drama.outline.trim().length > 0;

  const run = async () => {
    setConfirm(false);
    try {
      await start.mutateAsync(textOverride(picks));
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

  return (
    <section className="flex flex-col gap-4" aria-labelledby="story-title">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="story-title" className="font-display text-3xl font-semibold tracking-wide">
          {t('title')}
        </h2>
        <span className="text-xs text-muted tabular-nums">{t('chars', { count: draft.length, max: OUTLINE_MAX_CHARS })}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={save} loading={update.isPending} disabled={!dirty || running}>
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
          <Button size="sm" variant={hasOutline ? 'primary' : 'secondary'} onClick={onPlan} disabled={running || planRunning}>
            <ListPlus className="h-3.5 w-3.5" aria-hidden />
            {t('plan')}
          </Button>
        </div>
      </div>
      <p className="max-w-2xl text-sm text-ink-2">{t('hint')}</p>
      {running ? (
        <p className="flex items-center gap-2 text-sm text-ink-2" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-accent" aria-hidden />
          {t('running')}
        </p>
      ) : null}
      {failed !== null ? (
        <p className="flex max-w-2xl items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t('failed', { error: failed })}</span>
        </p>
      ) : null}
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
    </section>
  );
}
