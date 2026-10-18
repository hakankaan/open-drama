import { PROMPT_FIELDS, type AssetKind } from '@open-drama/contracts';

/** Whether any of `keys` is given in `input` with a value other than the current one. */
export const changed = <T extends object>(current: T, input: Partial<T>, keys: readonly (keyof T)[]) =>
  keys.some((k) => input[k] !== undefined && input[k] !== current[k]);

/** `changed` over the kind's prompt fields, whatever row shape the caller holds. */
const promptFieldChanged = (kind: AssetKind, current: object, input: object) =>
  changed(current as Record<string, unknown>, input as Record<string, unknown>, PROMPT_FIELDS[kind]);

/** Whether the patch touches a field the kind's final prompt is written from (adr-0024). */
export const touchesPrompt = (kind: AssetKind, patch: object) => PROMPT_FIELDS[kind].some((k) => k in patch);

/**
 * The finalPrompt rule shared by every write to an asset's fields (the manual update, an extraction's fill, a design
 * run): an explicit finalPrompt wins and clears the stale flag; otherwise a change to a field the prompt is written
 * from keeps the prompt and marks it stale.
 */
export function promptPatch(kind: AssetKind, current: { finalPrompt: string | null } & object, input: { finalPrompt?: string | null } & object) {
  if (input.finalPrompt !== undefined) return { finalPrompt: input.finalPrompt, finalPromptStale: false };
  if (current.finalPrompt && promptFieldChanged(kind, current, input)) return { finalPromptStale: true };
  return {};
}
