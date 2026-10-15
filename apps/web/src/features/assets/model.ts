import {
  CharacterView,
  type AssetKind,
  type CharacterCard,
  type CharacterViews,
  type GeneratedView,
  type PropCard,
  type SceneCard,
  type TaskSummary,
} from '@open-drama/contracts';

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

/**
 * The views a character's Generate draws (adr-0018): a new headshot (from the sheet while there is no headshot), then
 * the full body and every turnaround view the character has, drawn again from that headshot.
 */
export function regeneratedViews(views: CharacterViews): GeneratedView[] {
  return ['headshot', 'body', ...(['side', 'back'] as const).filter((v) => views[v])];
}

/** The views a character has, in display order. */
export const presentViews = (views: CharacterViews): CharacterView[] => CharacterView.options.filter((v) => views[v]);

/** An image request's `views`: what a character draws (`regeneratedViews` unless given); scenes and props have none. */
export const viewsBody = (item: AnyAsset, views?: GeneratedView[]) =>
  item.kind === 'character' ? { views: views ?? regeneratedViews(item.asset.views) } : {};
