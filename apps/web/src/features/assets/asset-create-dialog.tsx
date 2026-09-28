'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AssetKind } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { useToastError } from '@/lib/errors';
import { useCreateAsset, type CreateAssetInput } from './api';
import { ASSET_FIELDS } from './fields';

export function AssetCreateDialog({
  kind,
  dramaId,
  episodeId,
  onClose,
}: {
  kind: AssetKind;
  dramaId: number;
  episodeId?: number;
  onClose: () => void;
}) {
  const t = useTranslations('assets');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const create = useCreateAsset(dramaId);
  const fields = ASSET_FIELDS[kind];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, ''])));
  const [touched, setTouched] = useState(false);
  const missing = fields.find((f) => f.required && !values[f.key]?.trim());

  const save = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (missing) return;
    const body = {
      dramaId,
      ...(episodeId ? { episodeId } : {}),
      ...Object.fromEntries(fields.map((f) => [f.key, values[f.key]!.trim()])),
    };
    try {
      await create.mutateAsync({ kind, body } as CreateAssetInput);
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent title={t(`create.${kind}`)}>
        <form onSubmit={save} className="flex flex-col gap-4" noValidate>
          {fields.map((f, i) => {
            const id = `new-${f.key}`;
            const error = touched && f.required && !values[f.key]?.trim() ? t('required') : undefined;
            const onChange = (value: string) => setValues((v) => ({ ...v, [f.key]: value }));
            return (
              <Field key={f.key} label={t(`fields.${f.key}`)} htmlFor={id} error={error}>
                {f.multiline ? (
                  <Textarea id={id} value={values[f.key]} maxLength={f.max} onChange={(e) => onChange(e.target.value)} className="min-h-20" />
                ) : (
                  <Input id={id} autoFocus={i === 0} value={values[f.key]} maxLength={f.max} onChange={(e) => onChange(e.target.value)} />
                )}
              </Field>
            );
          })}
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={create.isPending}>
              {tc('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
