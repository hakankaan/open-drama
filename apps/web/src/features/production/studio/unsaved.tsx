'use client';

import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type Unsaved = { report: (id: string, dirty: boolean) => void; guard: (leave: () => void) => void };

const UnsavedContext = createContext<Unsaved>({ report: () => {}, guard: (leave) => leave() });

/** Marks an explicit-save draft as unsaved while `dirty`, so leaving the panel that holds it asks first. */
export function useReportUnsaved(dirty: boolean) {
  const { report } = useContext(UnsavedContext);
  const id = useId();
  useEffect(() => {
    report(id, dirty);
    return () => report(id, false);
  }, [report, id, dirty]);
}

/** Runs a step switch or a navigation at once, or after a confirm while a draft is unsaved. */
export const useLeaveGuard = () => useContext(UnsavedContext).guard;

/** Marks the copy of the current history entry the studio adds while a draft is unsaved (see UnsavedDrafts). */
const HOLD = 'openDramaUnsaved';
const held = () => window.history.state?.[HOLD] === true;
const hold = () => window.history.pushState({ [HOLD]: true }, '');

/**
 * The studio's explicit-save drafts (raw content, script, recap) live in panels that unmount on a step switch, so
 * leaving with unsaved text asks first; closing or reloading the tab gets the browser's own prompt. The browser's
 * Back is a same-page navigation that prompts nothing, so while a draft is unsaved a copy of the current entry sits on
 * top of the history: Back lands on the real entry (the same page) and asks, and the copy goes once nothing is unsaved.
 */
export function UnsavedDrafts({ children }: { children: React.ReactNode }) {
  const t = useTranslations('studio.unsaved');
  const [dirty, setDirty] = useState<ReadonlySet<string>>(() => new Set());
  // What a confirm runs: an in-app leave, or 'back' for the browser's Back (cancelling it puts the copy back).
  const [pending, setPending] = useState<(() => void) | 'back' | null>(null);
  // Set while the studio itself moves through the history, so neither the guard nor the browser prompt steps in.
  const quiet = useRef(false);
  const any = dirty.size > 0;

  const report = useCallback(
    (id: string, on: boolean) =>
      setDirty((prev) => {
        if (prev.has(id) === on) return prev;
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );
  const guard = useCallback((leave: () => void) => (any ? setPending(() => leave) : leave()), [any]);
  const value = useMemo(() => ({ report, guard }), [report, guard]);

  useEffect(() => {
    if (!any) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (!quiet.current) e.preventDefault();
    };
    const onBack = () => {
      if (!quiet.current && !held()) setPending('back');
    };
    hold();
    window.addEventListener('beforeunload', warn);
    window.addEventListener('popstate', onBack);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('popstate', onBack);
      // Saved or discarded in place: the copy goes, so the next Back leaves at once.
      if (held()) window.history.back();
    };
  }, [any]);

  const confirm = () => {
    const next = pending;
    setPending(null);
    if (next === null) return;
    quiet.current = true;
    if (next === 'back') return window.history.back();
    if (!held()) {
      quiet.current = false;
      return next();
    }
    // The copy goes first, so the page left is not in the history twice.
    window.addEventListener(
      'popstate',
      () => {
        quiet.current = false;
        next();
      },
      { once: true },
    );
    window.history.back();
  };

  return (
    <UnsavedContext value={value}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (open) return;
          if (pending === 'back') hold();
          setPending(null);
        }}
        title={t('title')}
        description={t('body')}
        confirmLabel={t('leave')}
        onConfirm={confirm}
      />
    </UnsavedContext>
  );
}
