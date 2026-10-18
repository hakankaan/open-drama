import type { AssetKind } from '@open-drama/contracts';
import { conflict } from '../../http/errors';

/**
 * Assets with a request in flight that reads their fields and writes back: an image request, from its final prompt
 * (the prompt agent may run) to the task's submission, not the drawing itself; an outfit image request; a describe
 * run. One process, so an in-memory claim suffices. A bulk save (extraction, design) skips a claimed asset instead
 * of changing it under that request (adr-0024).
 */
const claimed = new Set<string>();

const keyOf = (kind: AssetKind, id: number) => `${kind}:${id}`;

export const isClaimed = (kind: AssetKind, id: number) => claimed.has(keyOf(kind, id));

/** Runs `fn` while the asset is claimed; refused with `409` when it already is. */
export async function withAssetClaim<T>(kind: AssetKind, id: number, fn: () => Promise<T>): Promise<T> {
  const key = keyOf(kind, id);
  if (claimed.has(key)) throw conflict('An image, a prompt or a description is already in progress for this asset');
  claimed.add(key);
  try {
    return await fn();
  } finally {
    claimed.delete(key);
  }
}
