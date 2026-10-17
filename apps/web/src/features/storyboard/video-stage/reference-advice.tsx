'use client';

import { Info, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { coverViewOf, referencePolicyFor, type CharacterCard, type EpisodeCharacterCard, type EpisodeView, type GeneratedView, type ShotCard } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { usePersistedState } from '@/lib/persisted-state';
import { useModelPicks } from '../../configuration/model-picks';
import { regeneratedViews } from '../../assets/model';
import { useBatchGenerate } from '../../assets/use-batch-generate';

const TURNAROUND = ['side', 'back'] as const;

/**
 * What the episode's characters lack for the target video model (adr-0018), only where the creator can act: a
 * character with nothing but a multi-view sheet on a model that may read it as several people, and missing side and
 * back views on a model that uses them. Each comes with the generation that settles it.
 */
export function ReferenceAdvice({
  episode,
  shots,
  characters,
  model,
}: {
  episode: EpisodeView;
  shots: ShotCard[];
  characters: EpisodeCharacterCard[];
  model: string | null;
}) {
  const t = useTranslations('studio.video.advice');
  const { picks } = useModelPicks();
  const batch = useBatchGenerate(episode.dramaId, episode.id, picks);
  const [turnaroundSeen, setTurnaroundSeen] = usePersistedState(`turnaround-advice:${episode.id}`, false);
  if (!model) return null;

  const policy = referencePolicyFor(model);
  // Characters some shot binds, and not generating right now.
  const bound = new Set(shots.flatMap((s) => s.bindings.characters.map((c) => c.id)));
  const cast = characters.filter((c) => bound.has(c.id) && c.latestImageTask?.status !== 'processing');
  const sheetOnly = policy.sheets ? [] : cast.filter((c) => coverViewOf(c.views) === 'sheet');
  // In an episode outfit only the face and the outfit's picture are sent (adr-0023): side and back views would not be.
  const turnaround = policy.turnaround
    ? cast.filter((c) => !c.outfit.trim()).flatMap((c) => {
        const missing = TURNAROUND.filter((v) => !c.views[v]);
        return c.views.headshot && missing.length ? [{ c, missing: missing as GeneratedView[] }] : [];
      })
    : [];
  const names = (list: CharacterCard[]) => list.map((c) => c.name).join(', ');
  const sheetImages = sheetOnly.reduce((n, c) => n + regeneratedViews(c.views).length, 0);
  const turnaroundImages = turnaround.reduce((n, x) => n + x.missing.length, 0);

  return (
    <>
      {sheetOnly.length ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-warning-soft px-4 py-1.5 text-xs text-warning" role="status">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{t('sheetOnly', { model, names: names(sheetOnly), count: sheetOnly.length })}</span>
          <Button
            size="sm"
            variant="quiet"
            className="h-7"
            loading={batch.running}
            onClick={() => void batch.run(sheetOnly.map((c) => ({ kind: 'character' as const, asset: c })))}
          >
            {batch.running ? null : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {t('sheetOnlyAction', { count: sheetImages })}
          </Button>
        </div>
      ) : null}
      {turnaround.length && !turnaroundSeen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-info-soft px-4 py-1.5 text-xs text-info" role="status">
          <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">{t('turnaround', { model, names: names(turnaround.map((x) => x.c)) })}</span>
          <Button
            size="sm"
            variant="quiet"
            className="h-7"
            loading={batch.running}
            onClick={() => void batch.run(turnaround.map((x) => ({ kind: 'character' as const, asset: x.c, views: x.missing })))}
          >
            {batch.running ? null : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {t('turnaroundAction', { count: turnaroundImages })}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTurnaroundSeen(true)} aria-label={t('dismiss')}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </>
  );
}
