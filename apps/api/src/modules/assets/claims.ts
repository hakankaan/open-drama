import type { AssetKind } from '@open-drama/contracts';
import { conflict } from '../../http/errors';

/**
 * Assets with a request in flight that reads their fields and writes back: an image request, from its final prompt
 * (the prompt agent may run) to the task's submission, not the drawing itself; an outfit image request; a describe
 * run; a final prompt written on its own (the studio's button, the assistant's `write_final_prompt`), while the agent
 * runs. One process, so an in-memory claim suffices. A bulk save (extraction, design) skips a claimed asset instead
 * of changing it under that request (adr-0024).
 */
const claimed = new Set<string>();

const keyOf = (kind: AssetKind, id: number) => `${kind}:${id}`;

export const isClaimed = (kind: AssetKind, id: number) => claimed.has(keyOf(kind, id));

/**
 * Refused with `409` while the asset is claimed. A hand edit (the studio's save, the assistant's `update_asset`)
 * checks this too: landing between a run's reading of the fields and its write, the edit would be filled over by
 * the description, and the prompt saved from the fields before it would clear the stale flag the edit had set.
 */
export function assertUnclaimed(kind: AssetKind, id: number) {
  if (isClaimed(kind, id)) throw conflict('An image, a prompt or a description is already in progress for this asset');
}

/** Runs `fn` while the asset is claimed; refused with `409` when it already is. */
export async function withAssetClaim<T>(kind: AssetKind, id: number, fn: () => Promise<T>): Promise<T> {
  assertUnclaimed(kind, id);
  const key = keyOf(kind, id);
  claimed.add(key);
  try {
    return await fn();
  } finally {
    claimed.delete(key);
  }
}
