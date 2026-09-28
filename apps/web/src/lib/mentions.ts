/**
 * The `@[Name]` mention grammar (Plan 1 §6): brackets allow multi-word names. The browser only writes and highlights
 * mentions; the API resolves them to reference slots on generation.
 */
export const MENTION = /@\[([^\]\n]+)\]/g;

export const mentionOf = (name: string) => `@[${name}]`;

export interface Segment {
  text: string;
  /** Set when this segment is a whole `@[Name]` token. */
  mention?: string;
}

/** Splits text into plain runs and mention tokens, in order. */
export function segments(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], mention: m[1]!.trim() });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** The mention token that ends exactly at `caret`, if any (so Backspace can remove it whole). */
export function tokenEndingAt(text: string, caret: number): { start: number; end: number } | null {
  for (const m of text.matchAll(MENTION)) {
    const end = m.index + m[0].length;
    if (end === caret) return { start: m.index, end };
  }
  return null;
}
