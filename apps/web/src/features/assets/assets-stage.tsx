'use client';

import { Loader2, Plus, ScanSearch, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AgentJob, AssetKind, EpisodeView, ExtractionTarget } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from '@/components/ui/tag';
import { useToastError } from '@/lib/errors';
import { textOverride, useModelPicks } from '../configuration/model-picks';
import { useEpisodeJobs } from '../production/api';
import { useDeleteAsset, useEpisodeAssets, useStartExtraction } from './api';
import { AssetCard } from './asset-card';
import { AssetCreateDialog } from './asset-create-dialog';
import { AssetDetailDialog } from './asset-detail-dialog';
import { KIND_ORDER, readinessOf, titleOf, type AnyAsset } from './model';
import { useAssetGeneration } from './use-asset-generation';
import { useBatchGenerate } from './use-batch-generate';
import { useImageUpload } from './use-image-upload';

const TARGET: Record<AssetKind, ExtractionTarget> = { character: 'characters', scene: 'scenes', prop: 'props' };

export function AssetsStage({ episode, onScript }: { episode: EpisodeView; onScript: () => void }) {
  const t = useTranslations('assets');
  const ts = useTranslations('studio.assets');
  const toastError = useToastError();
  const { picks } = useModelPicks();
  const assets = useEpisodeAssets(episode.id);
  const jobs = useEpisodeJobs(episode.id);
  const extract = useStartExtraction(episode.id);
  const remove = useDeleteAsset(episode.dramaId);
  const upload = useImageUpload(episode.dramaId);
  const generation = useAssetGeneration(episode.dramaId, episode.id, picks);
  const batch = useBatchGenerate(episode.dramaId, episode.id, picks);
  const [open, setOpen] = useState<{ kind: AssetKind; id: number } | null>(null);
  const [creating, setCreating] = useState<AssetKind | null>(null);
  const [deleting, setDeleting] = useState<AnyAsset | null>(null);

  // Production guard: extraction reads the script.
  if (!episode.scriptContent?.trim()) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col items-start gap-4 pt-10">
        <h2 className="font-display text-3xl font-semibold tracking-wide">{ts('title')}</h2>
        <p className="text-ink-2">{ts('needScript')}</p>
        <Button onClick={onScript}>{ts('toScript')}</Button>
      </section>
    );
  }
  if (assets.isLoading || !assets.data) return <Skeleton className="h-96" />;

  const data = assets.data;
  const groups: Record<AssetKind, AnyAsset[]> = {
    character: data.characters.map((asset) => ({ kind: 'character', asset })),
    scene: data.scenes.map((asset) => ({ kind: 'scene', asset })),
    prop: data.props.map((asset) => ({ kind: 'prop', asset })),
  };
  const jobOf = (kind: AssetKind): AgentJob | null => jobs.data?.extraction[TARGET[kind]] ?? data.extraction[TARGET[kind]] ?? null;
  const anyExtracting = KIND_ORDER.some((k) => jobOf(k)?.status === 'running');
  const total = KIND_ORDER.reduce((n, k) => n + groups[k].length, 0);
  const readyCount = KIND_ORDER.flatMap((k) => groups[k]).filter((i) => readinessOf(i.asset) === 'ready').length;
  const openItem = open ? groups[open.kind].find((i) => i.asset.id === open.id) : undefined;

  const startExtraction = async (kinds: AssetKind[]) => {
    for (const kind of kinds) {
      try {
        await extract.mutateAsync({ target: TARGET[kind], ...textOverride(picks) });
      } catch (err) {
        toastError(err);
      }
    }
  };

  const missing = (kind?: AssetKind) =>
    (kind ? groups[kind] : KIND_ORDER.flatMap((k) => groups[k])).filter((i) => {
      const r = readinessOf(i.asset);
      return r === 'pending' || r === 'failed';
    });

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ kind: deleting.kind, id: deleting.asset.id });
      setDeleting(null);
    } catch (err) {
      toastError(err);
    }
  };

  if (total === 0 && !anyExtracting) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col items-start gap-4 pt-10">
        <h2 className="font-display text-3xl font-semibold tracking-wide">{ts('title')}</h2>
        <p className="text-ink-2">{ts('emptyBody')}</p>
        {KIND_ORDER.map((k) => jobOf(k)).some((j) => j?.status === 'failed') ? (
          <p className="flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {KIND_ORDER.map((k) => jobOf(k)?.error).find(Boolean)}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => startExtraction(KIND_ORDER)} loading={extract.isPending}>
            <ScanSearch className="h-4 w-4" aria-hidden />
            {ts('extractAll')}
          </Button>
          {KIND_ORDER.map((k) => (
            <Button key={k} onClick={() => setCreating(k)}>
              <Plus className="h-4 w-4" aria-hidden />
              {t(`add.${k}`)}
            </Button>
          ))}
        </div>
        {creating ? <AssetCreateDialog kind={creating} dramaId={episode.dramaId} episodeId={episode.id} onClose={() => setCreating(null)} /> : null}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-3xl font-semibold tracking-wide">{ts('title')}</h2>
        <Tag tone={readyCount === total ? 'success' : 'neutral'}>{ts('ready', { ready: readyCount, total })}</Tag>
        <Button className="ml-auto" size="sm" variant="primary" onClick={() => batch.run(missing())} loading={batch.running} disabled={missing().length === 0}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          {ts('generateMissing', { count: missing().length })}
        </Button>
      </div>

      {KIND_ORDER.map((kind) => {
        const job = jobOf(kind);
        const extracting = job?.status === 'running';
        return (
          <section key={kind} className="flex flex-col gap-3" aria-labelledby={`stage-${kind}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={`stage-${kind}`} className="font-display text-2xl font-semibold tracking-wide">
                {t(`group.${kind}`)}
              </h3>
              <span className="text-sm text-muted tabular-nums">{groups[kind].length}</span>
              {extracting ? (
                <Tag tone="info">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  {ts('extracting')}
                </Tag>
              ) : job?.status === 'failed' ? (
                <Tag tone="danger">{ts('extractFailed')}</Tag>
              ) : null}
              <div className="ml-auto flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => setCreating(kind)}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  {t(`add.${kind}`)}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => startExtraction([kind])} disabled={extracting}>
                  <ScanSearch className="h-3.5 w-3.5" aria-hidden />
                  {groups[kind].length > 0 ? ts('reextract') : ts('extract')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => batch.run(missing(kind))} disabled={batch.running || missing(kind).length === 0}>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {ts('generateKind', { count: missing(kind).length })}
                </Button>
              </div>
            </div>
            {job?.status === 'failed' && job.error ? <p className="text-sm text-danger">{job.error}</p> : null}
            {groups[kind].length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong px-5 py-6 text-sm text-ink-2">
                {extracting ? ts('extractingBody') : t(`empty.${kind}`)}
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
                {groups[kind].map((item) => (
                  <AssetCard
                    key={item.asset.id}
                    item={item}
                    onOpen={() => setOpen({ kind, id: item.asset.id })}
                    onUpload={() => upload.pick(item)}
                    uploading={upload.isBusy(item)}
                    onGenerate={() => generation.image(item)}
                    generating={generation.isImagePending(item)}
                    onDelete={() => setDeleting(item)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {upload.fileInput}
      {openItem ? (
        <AssetDetailDialog
          key={`${openItem.kind}:${openItem.asset.id}`}
          item={openItem}
          dramaId={episode.dramaId}
          onClose={() => setOpen(null)}
          onUpload={() => upload.pick(openItem)}
          uploading={upload.isBusy(openItem)}
          generation={{
            onGeneratePrompt: () => generation.prompt(openItem),
            promptPending: generation.isPromptPending(openItem),
            onGenerateImage: () => generation.image(openItem),
            imagePending: generation.isImagePending(openItem),
          }}
        />
      ) : null}
      {creating ? <AssetCreateDialog kind={creating} dramaId={episode.dramaId} episodeId={episode.id} onClose={() => setCreating(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={ts('deleteTitle', { name: deleting ? titleOf(deleting) : '' })}
        description={ts('deleteBody')}
        confirmLabel={ts('deleteConfirm')}
        onConfirm={confirmDelete}
        pending={remove.isPending}
      />
    </div>
  );
}
