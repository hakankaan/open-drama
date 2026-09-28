'use client';

import { Tooltip as T } from 'radix-ui';

export const TooltipProvider = T.Provider;

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <T.Root delayDuration={300}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          sideOffset={6}
          className="z-50 max-w-64 rounded-md bg-ink px-2.5 py-1.5 text-xs text-bg shadow-md"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
