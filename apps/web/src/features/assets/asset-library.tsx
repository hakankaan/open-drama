'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AssetKind } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { useModelPicks } from '../configuration/model-picks';
import { useDramaAssets } from './api';
import { AssetCard } from './asset-card';
import { AssetCreateDialog } from './asset-create-dialog';
import { AssetDetailDialog } from './asset-detail-dialog';
import { KIND_ORDER, type AnyAsset } from './model';
import { useAssetGeneration } from './use-asset-generation';
import { useImageUpload } from './use-image-upload';

type Filter = AssetKind | 'all';

/**
 * DramaAssetLibrary on the project page: every asset of the drama, grouped by kind. Generation needs an episode
 * for the prompt agent's context; the first episode is used, and without one the buttons explain why they are off.
 */
export function AssetLibrary({ dramaId, episodeId }: { dramaId: number; episodeId: number | undefined }) {
  const t = useTranslations('assets');
  const library = useDramaAssets(dramaId);
  const upload = useImageUpload(dramaId);
  const { picks } = useModelPicks();
  const generation = useAssetGeneration(dramaId, episodeId, picks);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<{ kind: AssetKind; id: number } | null>(null);
  const [creating, setCreating] = useState<AssetKind | null>(null);

  if (library.isLoading) return <Skeleton className="h-64" />;
  const data = library.data;
  if (!data) return null;

  const groups: Record<AssetKind, AnyAsset[]> = {
    character: data.characters.map((asset) => ({ kind: 'character', asset })),
    scene: data.scenes.map((asset) => ({ kind: 'scene', asset })),
    prop: data.props.map((asset) => ({ kind: 'prop', asset })),
  };
  // Resolve the open asset from fresh data so the dialog reflects uploads made while it is open.
  const openItem = open ? groups[open.kind].find((i) => i.asset.id === open.id) : undefined;
  const kinds = filter === 'all' ? KIND_ORDER : [filter];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1 self-start rounded-full border border-line bg-surface p-1" role="group">
        {(['all', ...KIND_ORDER] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full px-3 py-1 text-[13px] font-medium transition-colors',
              filter === f ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink',
            )}
          >
            {f === 'all' ? t('filter.all') : t(`group.${f}`)}
            <span className="ml-1.5 text-xs opacity-60">
              {f === 'all' ? groups.character.length + groups.scene.length + groups.prop.length : groups[f].length}
            </span>
          </button>
        ))}
      </div>

      {kinds.map((kind) => (
        <section key={kind} className="flex flex-col gap-3" aria-labelledby={`group-${kind}`}>
          <div className="flex items-center gap-3">
            <h2 id={`group-${kind}`} className="font-display text-2xl font-semibold tracking-wide">
              {t(`group.${kind}`)}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => setCreating(kind)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t(`add.${kind}`)}
            </Button>
          </div>
          {groups[kind].length === 0 ? (
            <p className="rounded-lg border border-dashed border-line-strong px-5 py-6 text-sm text-ink-2">{t(`empty.${kind}`)}</p>
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
                  generateDisabled={episodeId ? undefined : t('needEpisode')}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      {upload.fileInput}
      {openItem ? (
        <AssetDetailDialog
          key={`${openItem.kind}:${openItem.asset.id}`}
          item={openItem}
          dramaId={dramaId}
          onClose={() => setOpen(null)}
          onUpload={() => upload.pick(openItem)}
          uploading={upload.isBusy(openItem)}
          generation={
            episodeId
              ? {
                  onGeneratePrompt: () => generation.prompt(openItem),
                  promptPending: generation.isPromptPending(openItem),
                  onGenerateImage: () => generation.image(openItem),
                  imagePending: generation.isImagePending(openItem),
                }
              : undefined
          }
        />
      ) : null}
      {creating ? <AssetCreateDialog kind={creating} dramaId={dramaId} onClose={() => setCreating(null)} /> : null}
    </div>
  );
}
