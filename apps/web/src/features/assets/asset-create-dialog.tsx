'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AssetKind } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Sparkles } from 'lucide-react';
import { useToastError } from '@/lib/errors';
import { useCreateAsset, type CreateAssetInput } from './api';
import { ASSET_FIELDS } from './fields';
import type { AnyAsset } from './model';
import type { Described } from './use-asset-generation';

/**
 * A new asset from the typed fields. "Describe with AI" creates it the same way, then has the designer fill its empty
 * fields from the story (adr-0024); when that fails the asset stays and `onOpen` shows it, so a retry describes it
 * instead of creating it again.
 */
export function AssetCreateDialog({
  kind,
  dramaId,
  episodeId,
  onClose,
  onDescribe,
  onOpen,
}: {
  kind: AssetKind;
  dramaId: number;
  episodeId?: number;
  onClose: () => void;
  onDescribe?: (item: AnyAsset) => Promise<Described>;
  onOpen?: (id: number) => void;
}) {
  const t = useTranslations('assets');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const create = useCreateAsset(dramaId);
  const fields = ASSET_FIELDS[kind];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, ''])));
  const [touched, setTouched] = useState(false);
  const [describing, setDescribing] = useState(false);
  const missing = fields.find((f) => f.required && !values[f.key]?.trim());
  const busy = create.isPending || describing;

  const submit = async (describe: boolean) => {
    setTouched(true);
    if (missing) return;
    const body = {
      dramaId,
      ...(episodeId ? { episodeId } : {}),
      ...Object.fromEntries(fields.map((f) => [f.key, values[f.key]!.trim()])),
    };
    let created;
    try {
      created = await create.mutateAsync({ kind, body } as CreateAssetInput);
    } catch (err) {
      toastError(err);
      return;
    }
    if (!describe || !onDescribe) return onClose();
    setDescribing(true);
    const described = await onDescribe({ kind, asset: created } as AnyAsset);
    setDescribing(false);
    onClose();
    if (described === null) onOpen?.(created.id);
  };

  const save = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    void submit(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
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
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {tc('cancel')}
            </Button>
            {onDescribe ? (
              <Button onClick={() => void submit(true)} loading={describing} disabled={create.isPending && !describing}>
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {t('describeWithAi')}
              </Button>
            ) : null}
            <Button type="submit" variant="primary" loading={create.isPending && !describing} disabled={describing}>
              {tc('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
