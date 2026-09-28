import type { AssetKind } from '@open-drama/contracts';

export interface FieldSpec {
  key: string;
  required?: boolean;
  multiline?: boolean;
  max: number;
}

/** Describing fields per kind, in display order (the same fields the contracts accept). */
export const ASSET_FIELDS: Record<AssetKind, FieldSpec[]> = {
  character: [
    { key: 'name', required: true, max: 80 },
    { key: 'role', max: 80 },
    { key: 'appearance', multiline: true, max: 4000 },
    { key: 'styling', multiline: true, max: 4000 },
    { key: 'description', multiline: true, max: 4000 },
  ],
  scene: [
    { key: 'location', required: true, max: 120 },
    { key: 'time', max: 60 },
    { key: 'prompt', multiline: true, max: 4000 },
    { key: 'lighting', multiline: true, max: 1000 },
  ],
  prop: [
    { key: 'name', required: true, max: 80 },
    { key: 'type', max: 60 },
    { key: 'description', multiline: true, max: 4000 },
  ],
};
