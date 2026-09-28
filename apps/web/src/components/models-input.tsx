'use client';

import { Star, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Ordered model list editor: Enter adds, pasting splits on commas and new lines, clicking a model makes it the
 * default (first), × removes it.
 */
export function ModelsInput({ value, onChange, id }: { value: string[]; onChange: (models: string[]) => void; id?: string }) {
  const t = useTranslations('settings.ai.models');
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const next = raw
      .split(/[,\n]/)
      .map((m) => m.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    onChange([...new Set([...value, ...next])]);
    setDraft('');
  };

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface p-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
      {value.map((model, i) => (
        <span
          key={model}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-sm pr-1 pl-2 font-mono text-xs',
            i === 0 ? 'bg-accent-soft text-accent-soft-ink' : 'bg-surface-2 text-ink-2',
          )}
        >
          <button
            type="button"
            onClick={() => onChange([model, ...value.filter((m) => m !== model)])}
            className="inline-flex items-center gap-1"
            title={i === 0 ? t('isDefault') : t('makeDefault')}
          >
            {i === 0 ? <Star className="h-3 w-3 fill-current" aria-label={t('isDefault')} /> : null}
            {model}
          </button>
          <button
            type="button"
            onClick={() => onChange(value.filter((m) => m !== model))}
            className="rounded-sm p-0.5 text-muted hover:bg-surface-3 hover:text-ink"
            aria-label={t('remove', { model })}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (/[,\n]/.test(text)) {
            e.preventDefault();
            add(text);
          }
        }}
        onBlur={() => add(draft)}
        placeholder={value.length === 0 ? t('placeholder') : t('addMore')}
        className="min-w-32 flex-1 bg-transparent px-1.5 font-mono text-xs text-ink outline-none placeholder:font-sans placeholder:text-muted"
      />
    </div>
  );
}
