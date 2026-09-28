'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { StylePresetValue, type StylePreset } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tag } from '@/components/ui/tag';
import { Tooltip } from '@/components/ui/tooltip';
import { useToastError } from '@/lib/errors';
import { useCreateStylePreset, useDeleteStylePreset, useStylePresets, useUpdateStylePreset } from '../api';

function PresetDialog({ preset, nextSort, onClose }: { preset: StylePreset | null; nextSort: number; onClose: () => void }) {
  const t = useTranslations('settings.styles.dialog');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const create = useCreateStylePreset();
  const update = useUpdateStylePreset();
  const [form, setForm] = useState({
    name: preset?.name ?? '',
    value: preset?.value ?? '',
    prompt: preset?.prompt ?? '',
    description: preset?.description ?? '',
    sortOrder: String(preset?.sortOrder ?? nextSort),
  });
  const [touched, setTouched] = useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const errors = {
    name: !form.name.trim() ? t('required') : undefined,
    value: preset ? undefined : StylePresetValue.safeParse(form.value).success ? undefined : t('invalidKey'),
    prompt: !form.prompt.trim() ? t('required') : undefined,
  };

  const save = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const body = {
      name: form.name.trim(),
      prompt: form.prompt.trim(),
      description: form.description.trim(),
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (preset) await update.mutateAsync({ id: preset.id, ...body });
      else await create.mutateAsync({ ...body, value: form.value.trim() });
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  const pending = create.isPending || update.isPending;
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent title={preset ? t('editTitle') : t('createTitle')} wide>
        <form onSubmit={save} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('name')} htmlFor="preset-name" error={touched ? errors.name : undefined}>
              <Input id="preset-name" value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={60} />
            </Field>
            <Field
              label={t('key')}
              htmlFor="preset-key"
              hint={preset ? t('keyImmutable') : t('keyHint')}
              error={touched ? errors.value : undefined}
            >
              <Input
                id="preset-key"
                value={form.value}
                disabled={Boolean(preset)}
                onChange={(e) => set('value', e.target.value.toLowerCase())}
                className="font-mono text-[13px]"
                maxLength={40}
              />
            </Field>
          </div>
          <Field label={t('prompt')} htmlFor="preset-prompt" hint={t('promptHint')} error={touched ? errors.prompt : undefined}>
            <Textarea
              id="preset-prompt"
              value={form.prompt}
              onChange={(e) => set('prompt', e.target.value)}
              className="min-h-28 font-mono text-[13px]"
              maxLength={2000}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <Field label={t('description')} htmlFor="preset-desc">
              <Input id="preset-desc" value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={300} />
            </Field>
            <Field label={t('sortOrder')} htmlFor="preset-sort">
              <Input id="preset-sort" type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} />
            </Field>
          </div>
          <DialogFooter>
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

export function StylesTab() {
  const t = useTranslations('settings.styles');
  const toastError = useToastError();
  const presets = useStylePresets(true);
  const update = useUpdateStylePreset();
  const remove = useDeleteStylePreset();
  const [editing, setEditing] = useState<StylePreset | 'new' | null>(null);
  const [deleting, setDeleting] = useState<StylePreset | null>(null);

  const list = presets.data ?? [];
  const nextSort = list.reduce((m, p) => Math.max(m, p.sortOrder), 0) + 10;

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">{t('summary', { active: list.filter((p) => p.isActive).length, total: list.length })}</p>
        <Button variant="primary" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" aria-hidden />
          {t('add')}
        </Button>
      </div>
      {presets.isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-line bg-surface">
          {list.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 border-t border-line px-5 py-4 first:border-t-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <Tag mono>{p.value}</Tag>
                {p.isBuiltIn ? <Tag tone="info">{t('builtIn')}</Tag> : null}
                {!p.isActive ? <Tag>{t('disabled')}</Tag> : null}
                <div className="ml-auto flex items-center gap-1">
                  <Switch
                    checked={p.isActive}
                    onCheckedChange={(isActive) => update.mutate({ id: p.id, isActive }, { onError: (err) => toastError(err) })}
                    label={t('active', { name: p.name })}
                  />
                  <Tooltip content={t('edit')}>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(p)} aria-label={t('edit')}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('delete')}>
                    <Button size="icon" variant="ghost" onClick={() => setDeleting(p)} aria-label={t('delete')}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
              <p className="line-clamp-2 font-mono text-xs text-ink-2">{p.prompt}</p>
              {p.description ? <p className="text-[13px] text-muted">{p.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <PresetDialog preset={editing === 'new' ? null : editing} nextSort={nextSort} onClose={() => setEditing(null)} />
      ) : null}
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
