import type { AssetKind, CharacterCard, PropCard, SceneCard, TaskSummary } from '@open-drama/contracts';

export type AnyAsset =
  | { kind: 'character'; asset: CharacterCard }
  | { kind: 'scene'; asset: SceneCard }
  | { kind: 'prop'; asset: PropCard };

export type Readiness = 'generating' | 'ready' | 'failed' | 'pending';

/** Plan 3 §4.6: from the latest image task and the image, never from a local flag; generating wins. */
export function readinessOf(asset: { imagePath: string | null; latestImageTask: TaskSummary | null }): Readiness {
  if (asset.latestImageTask?.status === 'processing') return 'generating';
  if (asset.imagePath) return 'ready';
  if (asset.latestImageTask?.status === 'failed') return 'failed';
  return 'pending';
}

export function titleOf(item: AnyAsset): string {
  if (item.kind === 'scene') return item.asset.time ? `${item.asset.location} (${item.asset.time})` : item.asset.location;
  return item.asset.name;
}

export function summaryOf(item: AnyAsset): string {
  switch (item.kind) {
    case 'character':
      return [item.asset.role, item.asset.appearance || item.asset.description].filter(Boolean).join(' — ');
    case 'scene':
      return item.asset.prompt || item.asset.lighting;
    case 'prop':
      return [item.asset.type, item.asset.description].filter(Boolean).join(' — ');
  }
}

export const KIND_ORDER: AssetKind[] = ['character', 'scene', 'prop'];
