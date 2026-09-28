'use client';

import { DropdownMenu as M } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;

/**
 * `keepFocus`: set when an item opens a dialog. Returning focus to the trigger on close would count as focus
 * leaving the new dialog and dismiss it at once.
 */
export function MenuContent({
  children,
  align = 'end',
  keepFocus,
}: {
  children: React.ReactNode;
  align?: 'start' | 'end';
  keepFocus?: boolean;
}) {
  return (
    <M.Portal>
      <M.Content
        align={align}
        onCloseAutoFocus={keepFocus ? (e) => e.preventDefault() : undefined}
        sideOffset={6}
        className="z-50 min-w-44 rounded-md border border-line bg-surface p-1 shadow-md"
      >
        {children}
      </M.Content>
    </M.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  danger,
  checked,
  disabled,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  checked?: boolean;
  disabled?: boolean;
}) {
  return (
    <M.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        'flex cursor-default items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      <span className="flex-1">{children}</span>
      {checked ? <Check className="h-3.5 w-3.5 text-accent" aria-hidden /> : null}
    </M.Item>
  );
}

export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
