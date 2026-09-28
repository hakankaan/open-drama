'use client';

import { Select as S } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  id,
  className,
  disabled,
}: {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        id={id}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 text-left text-sm text-ink transition-colors hover:border-line-strong focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none disabled:opacity-60 data-[placeholder]:text-muted',
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <ChevronDown className="h-4 w-4 text-muted" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-80 w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-line bg-surface shadow-md"
        >
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex cursor-default flex-col rounded-sm py-1.5 pr-8 pl-2.5 text-sm outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2"
              >
                <S.ItemText>{o.label}</S.ItemText>
                {o.hint ? <span className="text-xs text-muted">{o.hint}</span> : null}
                <S.ItemIndicator className="absolute top-2 right-2">
                  <Check className="h-3.5 w-3.5 text-accent" />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
