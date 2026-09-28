/**
 * Near-name normalisation shared by manual creation and (in the AI pipeline) extraction dedup:
 * case, width, whitespace and punctuation differences do not make a new asset.
 */
export const normaliseName = (value: string) =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');

/** Scene identity is the normalised location plus the time of day. */
export const sceneKey = (location: string, time: string) => `${normaliseName(location)}@${normaliseName(time)}`;
