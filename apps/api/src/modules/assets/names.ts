/**
 * Near-name normalisation shared by manual creation and extraction dedup: parenthesised qualifiers
 * ("Mei (young)"), case, width, whitespace and punctuation differences do not make a new asset.
 */
export const normaliseName = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '');

/** Scene identity is the normalised location plus the time of day. */
export const sceneKey = (location: string, time: string) => `${normaliseName(location)}@${normaliseName(time)}`;
