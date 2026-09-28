'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import type { ServiceType } from '@open-drama/contracts';
import { Select } from '@/components/ui/select';
import { useModelServices } from '@/features/configuration/api';
import type { ModelPick } from '@/features/configuration/model-picks';

/** Picks a model among the active services of a type; the first option is the default. */
export function ModelSelect({
  type,
  value,
  onChange,
  className,
}: {
  type: ServiceType;
  value: ModelPick;
  onChange: (pick: ModelPick) => void;
  className?: string;
}) {
  const t = useTranslations('studio.models');
  const services = useModelServices(type, true);
  const options = [
    { value: 'default', label: t('default'), hint: services.data?.[0]?.models[0] },
    ...(services.data ?? []).flatMap((s) =>
      s.models.map((m) => ({ value: `${s.id}/${m}`, label: m, hint: s.name })),
    ),
  ];
  const valid = !!value && options.some((o) => o.value === `${value.serviceId}/${value.model}`);
  const current = valid ? `${value.serviceId}/${value.model}` : 'default';
  // A pick whose service or model was removed or disabled falls back to the default instead of being sent on.
  useEffect(() => {
    if (value && services.data && !valid) onChange(null);
  }, [value, services.data, valid, onChange]);
  return (
    <div className={className}>
      <span className="sr-only">{t(type)}</span>
      <Select
        value={current}
        onValueChange={(v) => {
          if (v === 'default') return onChange(null);
          const slash = v.indexOf('/');
          onChange({ serviceId: Number(v.slice(0, slash)), model: v.slice(slash + 1) });
        }}
        options={options}
        className="h-8 text-[13px]"
      />
    </div>
  );
}
