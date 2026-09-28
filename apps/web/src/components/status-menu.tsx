'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DramaStatus as DramaStatusEnum, type DramaStatus } from '@open-drama/contracts';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/menu';
import { cn } from '@/lib/cn';
import { STATUS_TONE } from '@/features/production/status';

const TONE_CLASS = {
  neutral: 'bg-surface-2 text-ink-2',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
};

/** Status badge that opens a menu of the three statuses (shared by projects and episodes). */
export function StatusMenu({
  value,
  onChange,
  disabled,
}: {
  value: DramaStatus;
  onChange: (status: DramaStatus) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('status');
  return (
    <Menu>
      <MenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            'inline-flex h-6 items-center gap-1 rounded-full pr-1.5 pl-2.5 text-xs font-medium transition-[filter] hover:brightness-95',
            TONE_CLASS[STATUS_TONE[value]],
          )}
          aria-label={t('change', { status: t(value) })}
        >
          {t(value)}
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        {DramaStatusEnum.options.map((s) => (
          <MenuItem key={s} checked={s === value} onSelect={() => s !== value && onChange(s)}>
            {t(s)}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}
