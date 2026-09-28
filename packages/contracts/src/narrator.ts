/**
 * Narrator exclusion (Plan 3 §4.6): a narrator is a voice, not a character to draw. Characters whose name or role
 * matches these terms are left out of asset UI, bindings, mentions and counts.
 */
const NARRATOR_TERMS = ['narrator', 'voiceover', 'voice-over', 'voice over', '旁白', '画外音', 'ナレーター', 'ナレーション', '내레이터', '나레이션'];

export function isNarrator(name: string, role = ''): boolean {
  const haystack = `${name} ${role}`.toLowerCase();
  return NARRATOR_TERMS.some((term) => haystack.includes(term));
}
