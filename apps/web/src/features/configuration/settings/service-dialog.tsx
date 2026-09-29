'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  DEFERRED_PROVIDERS,
  PROVIDER_PRESETS,
  PROVIDERS_BY_TYPE,
  type ModelService,
  type ModelServiceProbe,
  type ProviderName,
  type ServiceType,
} from '@open-drama/contracts';
import { ModelsInput } from '@/components/models-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { useToastError } from '@/lib/errors';
import { useAddModelService, useTestModelService, useUpdateModelService } from '../api';
import { ProbeResult } from './probe-result';

export type ServiceDialogState =
  | { mode: 'create'; serviceType: ServiceType; provider: ProviderName }
  | { mode: 'edit'; service: ModelService };

interface Form {
  provider: ProviderName;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  priority: string;
  temperature: string;
}

function initialForm(state: ServiceDialogState): Form {
  if (state.mode === 'edit') {
    const s = state.service;
    return {
      provider: s.provider,
      name: s.name,
      baseUrl: s.baseUrl,
      apiKey: '',
      models: s.models,
      priority: String(s.priority),
      temperature: s.settings.temperature != null ? String(s.settings.temperature) : '',
    };
  }
  const preset = PROVIDER_PRESETS[state.provider];
  return {
    provider: state.provider,
    name: preset.label,
    baseUrl: preset.baseUrlByType?.[state.serviceType] ?? preset.baseUrl,
    apiKey: '',
    models: preset.models[state.serviceType] ?? [],
    priority: '0',
    temperature: '',
  };
}

export function ServiceDialog({ state, onClose }: { state: ServiceDialogState; onClose: () => void }) {
  const t = useTranslations('settings.ai.dialog');
  const tc = useTranslations('common');
  const tt = useTranslations('serviceType');
  const toastError = useToastError();
  const add = useAddModelService();
  const update = useUpdateModelService();
  const test = useTestModelService();

  const serviceType = state.mode === 'edit' ? state.service.serviceType : state.serviceType;
  const editing = state.mode === 'edit' ? state.service : null;
  const [form, setForm] = useState<Form>(() => initialForm(state));
  const [probe, setProbe] = useState<ModelServiceProbe | null>(null);
  const [touched, setTouched] = useState(false);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const choosePreset = (provider: ProviderName) => {
    const preset = PROVIDER_PRESETS[provider];
    setForm((f) => ({
      ...f,
      provider,
      baseUrl: preset.baseUrlByType?.[serviceType] ?? preset.baseUrl,
      name: editing ? f.name : preset.label,
      models: f.models.length > 0 && editing ? f.models : (preset.models[serviceType] ?? []),
    }));
    setProbe(null);
  };

  const temperature = form.temperature.trim() === '' ? null : Number(form.temperature);
  const errors = {
    name: !form.name.trim() ? t('required') : undefined,
    baseUrl: !/^https?:\/\/\S+$/.test(form.baseUrl.trim()) ? t('invalidUrl') : undefined,
    temperature: temperature !== null && !(temperature >= 0 && temperature <= 2) ? t('invalidTemperature') : undefined,
    apiKey: !editing && !form.apiKey.trim() ? t('keyRequired') : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);

  const runTest = async () => {
    setProbe(null);
    try {
      setProbe(
        await test.mutateAsync({
          id: editing?.id,
          serviceType,
          provider: form.provider,
          baseUrl: form.baseUrl.trim(),
          apiKey: form.apiKey.trim() || undefined,
          model: form.models[0],
        }),
      );
    } catch (err) {
      toastError(err);
    }
  };

  const save = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const common = {
      provider: form.provider,
      name: form.name.trim(),
      baseUrl: form.baseUrl.trim(),
      models: form.models,
      priority: Number(form.priority) || 0,
      settings: serviceType === 'text' ? { temperature } : {},
    };
    try {
      if (editing) {
        // The key is write-only: it is sent only when a replacement was typed.
        await update.mutateAsync({ id: editing.id, ...common, ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}) });
      } else {
        await add.mutateAsync({ serviceType, ...common, apiKey: form.apiKey.trim() });
      }
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  const pending = add.isPending || update.isPending;
  const providers = PROVIDERS_BY_TYPE[serviceType];

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent
        title={editing ? t('editTitle', { type: tt(serviceType) }) : t('createTitle', { type: tt(serviceType) })}
        wide
      >
        <form onSubmit={save} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('presets')}>
            {providers.map((p) => {
              const deferred = DEFERRED_PROVIDERS.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  disabled={deferred}
                  onClick={() => choosePreset(p)}
                  aria-pressed={form.provider === p}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    form.provider === p
                      ? 'border-accent bg-accent-soft text-accent-soft-ink'
                      : 'border-line text-ink-2 hover:border-line-strong',
                  )}
                >
                  {PROVIDER_PRESETS[p].label}
                  {deferred ? <span className="ml-1 text-xs text-muted">{t('iteration2')}</span> : null}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('name')} htmlFor="svc-name" error={touched ? errors.name : undefined}>
              <Input id="svc-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={100} />
            </Field>
            <Field label={t('provider')} htmlFor="svc-provider">
              <Select
                id="svc-provider"
                value={form.provider}
                onValueChange={(v) => choosePreset(v as ProviderName)}
                options={providers.map((p) => ({
                  value: p,
                  label: PROVIDER_PRESETS[p].label,
                  disabled: DEFERRED_PROVIDERS.includes(p),
                  hint: DEFERRED_PROVIDERS.includes(p) ? t('iteration2') : undefined,
                }))}
              />
            </Field>
          </div>

          <Field
            label={t('apiKey')}
            htmlFor="svc-key"
            hint={editing ? (editing.hasKey ? t('keyStored') : t('keyMissing')) : t('keyHint')}
            error={touched ? errors.apiKey : undefined}
          >
            <Input
              id="svc-key"
              type="password"
              autoComplete="off"
              value={form.apiKey}
              onChange={(e) => set('apiKey', e.target.value)}
              placeholder={editing?.hasKey ? t('replaceKey') : ''}
            />
          </Field>

          <Field label={t('baseUrl')} htmlFor="svc-url" error={touched ? errors.baseUrl : undefined}>
            <Input id="svc-url" value={form.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} className="font-mono text-[13px]" />
          </Field>

          <Field label={t('models')} htmlFor="svc-models" hint={t('modelsHint')}>
            <ModelsInput id="svc-models" value={form.models} onChange={(m) => set('models', m)} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('priority')} htmlFor="svc-priority" hint={t('priorityHint')}>
              <Input
                id="svc-priority"
                type="number"
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
              />
            </Field>
            {serviceType === 'text' ? (
              <Field
                label={t('temperature')}
                htmlFor="svc-temp"
                hint={t('temperatureHint')}
                error={touched ? errors.temperature : undefined}
              >
                <Input
                  id="svc-temp"
                  inputMode="decimal"
                  value={form.temperature}
                  onChange={(e) => set('temperature', e.target.value)}
                  placeholder="0.7"
                />
              </Field>
            ) : null}
          </div>

          {probe ? <ProbeResult probe={probe} /> : null}

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={runTest}
              loading={test.isPending}
              disabled={!form.baseUrl.trim() || (!editing?.hasKey && !form.apiKey.trim())}
              className="mr-auto"
            >
              {t('test')}
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
