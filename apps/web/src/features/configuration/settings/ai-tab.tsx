'use client';

import { ExternalLink, Pencil, Plus, Star, Trash2, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  DEFERRED_PROVIDERS,
  PROVIDER_PRESETS,
  PROVIDERS_BY_TYPE,
  QUICK_SETUP_TEMPLATES,
  SERVICE_TYPES,
  type ModelService,
  type ModelServiceProbe,
  type ServiceType,
} from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Field, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { useToastError } from '@/lib/errors';
import {
  useApplyQuickSetup,
  useDeleteModelService,
  useModelServices,
  useTestModelService,
  useUpdateModelService,
} from '../api';
import { ProbeResult } from './probe-result';
import { ServiceDialog, type ServiceDialogState } from './service-dialog';

function QuickSetup() {
  const t = useTranslations('settings.ai.quick');
  const toastError = useToastError();
  const apply = useApplyQuickSetup();
  const template = QUICK_SETUP_TEMPLATES[0]!;
  const [key, setKey] = useState('');

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!key.trim()) return;
    try {
      const result = await apply.mutateAsync({ gateway: template.gateway, apiKey: key.trim() });
      setKey('');
      toast.success(t('applied', { count: result.services.length }));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <section className="rounded-lg border border-line bg-surface p-5" aria-labelledby="quick-setup">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-xl flex-col gap-1">
          <h2 id="quick-setup" className="flex items-center gap-2 text-base font-semibold">
            <Zap className="h-4 w-4 text-accent" aria-hidden />
            {t('title', { gateway: template.label })}
          </h2>
          <p className="text-sm text-ink-2">{t('body', { gateway: template.label })}</p>
        </div>
        <a
          href={template.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-soft-ink hover:underline"
        >
          {t('getKey')}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
      <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <Field label={t('key')} htmlFor="quick-key">
            <Input
              id="quick-key"
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={t('keyPlaceholder')}
            />
          </Field>
        </div>
        <Button type="submit" variant="primary" loading={apply.isPending} disabled={!key.trim()}>
          {t('apply')}
        </Button>
      </form>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {template.services.map((s) => (
          <li key={s.serviceType} className="rounded-md bg-surface-2 px-3 py-2 text-[13px]">
            <p className="font-medium text-ink">{s.name}</p>
            <p className="truncate font-mono text-xs text-muted" title={s.models.join(', ')}>
              {s.models[0]}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ServiceRow({
  service,
  onEdit,
  onDelete,
}: {
  service: ModelService;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations('settings.ai.row');
  const toastError = useToastError();
  const update = useUpdateModelService();
  const test = useTestModelService();
  const [probe, setProbe] = useState<ModelServiceProbe | null>(null);

  const pin = (model: string) =>
    update.mutate(
      { id: service.id, models: [model, ...service.models.filter((m) => m !== model)] },
      { onError: (err) => toastError(err) },
    );

  const runTest = async () => {
    setProbe(null);
    try {
      setProbe(await test.mutateAsync({ id: service.id }));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <li className="flex flex-col gap-3 border-t border-line px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="accent">{PROVIDER_PRESETS[service.provider].label}</Tag>
        <span className="font-medium">{service.name}</span>
        {service.hasKey ? <Tag tone="success">{t('keySet')}</Tag> : <Tag tone="warning">{t('noKey')}</Tag>}
        {!service.isActive ? <Tag>{t('disabled')}</Tag> : null}
        {service.priority !== 0 ? <Tag>{t('priority', { priority: service.priority })}</Tag> : null}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={runTest} loading={test.isPending} disabled={!service.hasKey}>
            {t('test')}
          </Button>
          <Switch
            checked={service.isActive}
            onCheckedChange={(isActive) =>
              update.mutate({ id: service.id, isActive }, { onError: (err) => toastError(err) })
            }
            label={t('active', { name: service.name })}
          />
          <Tooltip content={t('edit')}>
            <Button size="icon" variant="ghost" onClick={onEdit} aria-label={t('edit')}>
              <Pencil className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content={t('delete')}>
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label={t('delete')}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {service.models.length === 0 ? (
          <span className="text-[13px] text-warning">{t('noModels')}</span>
        ) : (
          service.models.map((model, i) => (
            <button
              key={model}
              type="button"
              onClick={() => i > 0 && pin(model)}
              title={i === 0 ? t('defaultModel') : t('makeDefault')}
              className={
                i === 0
                  ? 'inline-flex h-6 items-center gap-1 rounded-sm bg-accent-soft px-2 font-mono text-xs text-accent-soft-ink'
                  : 'inline-flex h-6 items-center rounded-sm bg-surface-2 px-2 font-mono text-xs text-ink-2 hover:bg-surface-3'
              }
            >
              {i === 0 ? <Star className="h-3 w-3 fill-current" aria-hidden /> : null}
              {model}
            </button>
          ))
        )}
        <span className="ml-auto truncate font-mono text-xs text-muted">{service.baseUrl}</span>
      </div>
      {probe ? <ProbeResult probe={probe} /> : null}
    </li>
  );
}

function TypeCard({
  type,
  services,
  onCreate,
  onEdit,
  onDelete,
}: {
  type: ServiceType;
  services: ModelService[];
  onCreate: (state: ServiceDialogState) => void;
  onEdit: (service: ModelService) => void;
  onDelete: (service: ModelService) => void;
}) {
  const t = useTranslations('settings.ai');
  const ready = services.some((s) => s.isActive);
  return (
    <section className="rounded-lg border border-line bg-surface" aria-labelledby={`type-${type}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <h2 id={`type-${type}`} className="font-display text-2xl font-semibold tracking-wide">
          {t(`types.${type}`)}
        </h2>
        {ready ? <Tag tone="success">{t('ready')}</Tag> : <Tag tone="warning">{t('missing')}</Tag>}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">{t('addFrom')}</span>
          {PROVIDERS_BY_TYPE[type].map((p) => {
            const deferred = DEFERRED_PROVIDERS.includes(p);
            return (
              <Tooltip key={p} content={deferred ? t('comingLater') : t('addProvider', { provider: PROVIDER_PRESETS[p].label })}>
                <span>
                  <Button
                    size="sm"
                    variant="quiet"
                    disabled={deferred}
                    onClick={() => onCreate({ mode: 'create', serviceType: type, provider: p })}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    {PROVIDER_PRESETS[p].label}
                  </Button>
                </span>
              </Tooltip>
            );
          })}
        </div>
      </header>
      {services.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-2">{t('empty', { type: t(`types.${type}`) })}</p>
      ) : (
        <ul>
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} onEdit={() => onEdit(s)} onDelete={() => onDelete(s)} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function AiTab() {
  const t = useTranslations('settings.ai');
  const toastError = useToastError();
  const services = useModelServices();
  const remove = useDeleteModelService();
  const [dialog, setDialog] = useState<ServiceDialogState | null>(null);
  const [deleting, setDeleting] = useState<ModelService | null>(null);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      setDeleting(null);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <QuickSetup />
      {services.isLoading
        ? SERVICE_TYPES.map((type) => <Skeleton key={type} className="h-40" />)
        : SERVICE_TYPES.map((type) => (
            <TypeCard
              key={type}
              type={type}
              services={(services.data ?? []).filter((s) => s.serviceType === type)}
              onCreate={setDialog}
              onEdit={(service) => setDialog({ mode: 'edit', service })}
              onDelete={setDeleting}
            />
          ))}
      {dialog ? <ServiceDialog key={JSON.stringify(dialog)} state={dialog} onClose={() => setDialog(null)} /> : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t('deleteTitle', { name: deleting?.name ?? '' })}
        description={t('deleteBody')}
        confirmLabel={t('deleteConfirm')}
        onConfirm={confirmDelete}
        pending={remove.isPending}
      />
    </div>
  );
}
