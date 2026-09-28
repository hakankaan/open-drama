'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { mentionOf, segments, tokenEndingAt } from '@/lib/mentions';

export interface MentionOption {
  name: string;
  /** Shown next to the name in the picker (e.g. "Character"). */
  group: string;
}

// The backdrop and the textarea must lay text out identically.
const TEXT = 'px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words font-[inherit]';

/**
 * A textarea for video prompts with the `@[Name]` grammar (Plan 3 §4.5): typing `@` opens a picker over `options`
 * (the bound assets), picking inserts `@[Name] `, Backspace right after a token removes it whole, and the backdrop
 * highlights tokens (names that are not bound show as warnings). The stored text keeps the `@[Name]` form.
 */
export function MentionTextarea({
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  disabled,
  className,
  id,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: MentionOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  labels: { picker: string; empty: string; unbound: string };
}) {
  const listId = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  // Where the `@` that opened the picker sits; null when the picker is closed.
  const [anchor, setAnchor] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const bound = new Set(options.map((o) => o.name.toLowerCase()));
  const matches = anchor === null ? [] : options.filter((o) => o.name.toLowerCase().includes(query.toLowerCase()));

  const close = () => {
    setAnchor(null);
    setQuery('');
    setActive(0);
  };

  const pick = (option: MentionOption) => {
    const el = area.current;
    if (!el || anchor === null) return;
    const caret = el.selectionStart;
    const token = `${mentionOf(option.name)} `;
    const next = value.slice(0, anchor) + token + value.slice(caret);
    onChange(next);
    close();
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(anchor + token.length, anchor + token.length);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    if (anchor !== null && matches.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(matches[Math.min(active, matches.length - 1)]!);
        return;
      }
    }
    if (anchor !== null && e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'Backspace' && el.selectionStart === el.selectionEnd) {
      const token = tokenEndingAt(value, el.selectionStart);
      if (token) {
        e.preventDefault();
        onChange(value.slice(0, token.start) + value.slice(token.end));
        requestAnimationFrame(() => el.setSelectionRange(token.start, token.start));
      }
    }
  };

  const onInput = (next: string, caret: number) => {
    onChange(next);
    // The picker follows the text between the last `@` and the caret, until a bracket or line break ends it.
    const before = next.slice(0, caret);
    const at = before.lastIndexOf('@');
    const typed = at >= 0 ? before.slice(at + 1) : '';
    if (at >= 0 && !/[[\]\n]/.test(typed) && typed.length <= 40 && (at === 0 || /\s/.test(before[at - 1]!))) {
      setAnchor(at);
      setQuery(typed);
      setActive(0);
    } else close();
  };

  return (
    <div className={cn('relative', className)}>
      <div
        ref={backdrop}
        aria-hidden
        className={cn(
          TEXT,
          'pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-transparent text-transparent',
        )}
      >
        {segments(value).map((s, i) =>
          s.mention ? (
            <mark
              key={i}
              className={cn(
                'rounded-sm text-transparent',
                bound.has(s.mention.toLowerCase()) ? 'bg-accent-soft' : 'bg-warning-soft outline outline-1 outline-warning',
              )}
              title={bound.has(s.mention.toLowerCase()) ? undefined : labels.unbound}
            >
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
        {/* A trailing newline needs a character to occupy the last line. */}
        {'​'}
      </div>
      <textarea
        ref={area}
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => onInput(e.target.value, e.target.selectionStart)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // Let a click on the picker land before it closes.
          setTimeout(close, 150);
          onBlur?.();
        }}
        onScroll={(e) => {
          if (backdrop.current) backdrop.current.scrollTop = e.currentTarget.scrollTop;
        }}
        className={cn(
          TEXT,
          'relative block min-h-40 w-full resize-y rounded-md border border-line bg-transparent text-ink placeholder:text-muted hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none disabled:opacity-60',
        )}
        role="combobox"
        aria-controls={listId}
        aria-expanded={anchor !== null}
        aria-autocomplete="list"
      />
      {anchor !== null ? (
        <div
          id={listId}
          role="listbox"
          aria-label={labels.picker}
          className="absolute top-full left-0 z-30 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-md"
        >
          {matches.length === 0 ? (
            <p className="px-2.5 py-1.5 text-xs text-muted">{labels.empty}</p>
          ) : (
            matches.map((o, i) => (
              <button
                key={`${o.group}:${o.name}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm',
                  i === active ? 'bg-surface-2' : 'hover:bg-surface-2',
                )}
              >
                <span className="truncate">{o.name}</span>
                <span className="shrink-0 text-xs text-muted">{o.group}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
