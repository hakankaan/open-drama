'use client';

import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PLAN_MAX_COUNT, Resolution as ResolutionEnum, type DramaDetail } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToastError } from '@/lib/errors';
import { textOverride, useModelPicks } from '../../configuration/model-picks';
import { useStartPlan } from '../api';
import { EarlierRecaps } from '../earlier-recaps';
import { parseTarget, TargetLengthField } from '../episode-length';

/** PlanEpisodes (adr-0015): how many episodes to add after the last one, their length, resolution and locked services. */
export function PlanEpisodesDialog({ drama, onClose, onStarted }: { drama: DramaDetail; onClose: () => void; onStarted: () => void }) {
  const t = useTranslations('project.plan');
  const tn = useTranslations('project.newEpisode');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const { picks } = useModelPicks();
  const start = useStartPlan(drama.id);
  const [count, setCount] = useState('6');
  const [resolution, setResolution] = useState<string>('720p');
  const [length, setLength] = useState('');
  const target = parseTarget(length);
  const n = Number(count.trim());
  const countValid = count.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= PLAN_MAX_COUNT;
  const last = drama.episodes.at(-1)?.episodeNumber ?? 0;
  // The planner only adds after the last episode (adr-0015); hand-made episodes without beats stay as holes in the story.
  const empty = drama.episodes.filter((e) => !e.hasContent && !e.hasScript).map((e) => e.episodeNumber);

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!countValid || target === undefined) return;
    try {
      await start.mutateAsync({
        count: n,
        targetDurationSeconds: target ?? undefined,
        resolution: resolution as (typeof ResolutionEnum.options)[number],
        ...textOverride(picks),
      });
      onStarted();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !start.isPending && onClose()}>
      <DialogContent title={t('title')} description={t('description')}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-ink-2">{t('after', { last })}</p>
          {empty.length > 0 ? (
            <p className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning" role="status">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{t('empty', { count: empty.length, list: empty.join(', ') })}</span>
            </p>
          ) : null}
          <EarlierRecaps drama={drama} />
          <Field
            label={t('count')}
            htmlFor="plan-count"
            hint={t('countHint', { max: PLAN_MAX_COUNT })}
            error={countValid ? undefined : t('countInvalid', { max: PLAN_MAX_COUNT })}
          >
            <Input
              id="plan-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={PLAN_MAX_COUNT}
              step={1}
              autoFocus
              value={count}
              aria-invalid={!countValid}
              onChange={(e) => setCount(e.target.value)}
            />
          </Field>
          <TargetLengthField id="plan-length" value={length} onChange={setLength} />
          <Field label={tn('resolution')} htmlFor="plan-resolution" hint={tn('resolutionHint')}>
            <Select
              id="plan-resolution"
              value={resolution}
              onValueChange={setResolution}
              options={ResolutionEnum.options.map((r) => ({ value: r, label: r }))}
            />
          </Field>
          <p className="text-xs text-muted">{tn('lockNote')}</p>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={start.isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={start.isPending} disabled={!countValid || target === undefined}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
