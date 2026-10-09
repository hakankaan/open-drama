'use client';

import { Timer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { EPISODE_TARGET_MAX, EPISODE_TARGET_MIN, type EpisodeView } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { useToastError } from '@/lib/errors';
import { useUpdateEpisode } from './api';

/** A typed target length: whole seconds within the bounds, null for an empty field (follow the script), undefined when invalid. */
export function parseTarget(raw: string): number | null | undefined {
  const text = raw.trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isInteger(n) && n >= EPISODE_TARGET_MIN && n <= EPISODE_TARGET_MAX ? n : undefined;
}

/** The target-length input, shared by the new-episode dialog and the studio's length dialog. */
export function TargetLengthField({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const t = useTranslations('episodeLength');
  const invalid = parseTarget(value) === undefined;
  return (
    <Field
      label={t('field')}
      htmlFor={id}
      hint={t('hint')}
      error={invalid ? t('invalid', { min: EPISODE_TARGET_MIN, max: EPISODE_TARGET_MAX }) : undefined}
    >
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={EPISODE_TARGET_MIN}
        max={EPISODE_TARGET_MAX}
        step={1}
        autoFocus={autoFocus}
        value={value}
        placeholder={t('placeholder')}
        aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** The studio's episode-length control: the target the rewrite and the breakdown fit, or none (follow the script). */
export function EpisodeLengthButton({ episode }: { episode: EpisodeView }) {
  const t = useTranslations('episodeLength');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const update = useUpdateEpisode();
  const [draft, setDraft] = useState<string | null>(null);
  const target = episode.targetDurationSeconds;
  const parsed = draft === null ? undefined : parseTarget(draft);

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (parsed === undefined) return;
    try {
      if (parsed !== target) await update.mutateAsync({ id: episode.id, targetDurationSeconds: parsed });
      setDraft(null);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setDraft(target ? String(target) : '')}
        aria-label={target ? t('button', { seconds: target }) : t('buttonNone')}
      >
        <Timer className="h-3.5 w-3.5" aria-hidden />
        <span className="font-mono text-xs">{target ? t('chip', { seconds: target }) : t('chipNone')}</span>
      </Button>
      <Dialog open={draft !== null} onOpenChange={(o) => !o && !update.isPending && setDraft(null)}>
        <DialogContent title={t('title')} description={t('body')}>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <TargetLengthField id="episode-length" value={draft ?? ''} onChange={setDraft} autoFocus />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDraft(null)} disabled={update.isPending}>
                {tc('cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={update.isPending} disabled={parsed === undefined}>
                {tc('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
