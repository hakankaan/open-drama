'use client';

import type { ServiceType } from '@open-drama/contracts';
import { usePersistedState } from '@/lib/persisted-state';

/** A model pick: a service and one of its models. null = the service default (highest priority, first model). */
export type ModelPick = { serviceId: number; model: string } | null;
export type ModelPicks = Record<ServiceType, ModelPick>;

const EMPTY: ModelPicks = { text: null, image: null, video: null };

/** The creator's model picks per type, kept in the browser (Plan 3 §2 UI state). */
export function useModelPicks() {
  const [picks, setPicks] = usePersistedState<ModelPicks>('model-picks', EMPTY);
  const setPick = (type: ServiceType, pick: ModelPick) => setPicks((p) => ({ ...p, [type]: pick }));
  return { picks, setPick };
}

/** Overrides for agent-backed endpoints. */
export const textOverride = (picks: ModelPicks) =>
  picks.text ? { textServiceId: picks.text.serviceId, model: picks.text.model } : {};

/** Overrides for image requests: the image pick plus the text pick for the prompt agent. */
export const imageOverride = (picks: ModelPicks) => ({
  ...(picks.image ? { imageServiceId: picks.image.serviceId, model: picks.image.model } : {}),
  ...(picks.text ? { textServiceId: picks.text.serviceId, textModel: picks.text.model } : {}),
});
