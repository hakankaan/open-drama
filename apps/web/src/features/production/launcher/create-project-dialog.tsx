'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AspectRatio as AspectRatioEnum, type AspectRatio } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';
import { useToastError } from '@/lib/errors';
import { useStylePresets } from '../../configuration/api';
import { useCreateDrama } from '../api';

const SHAPE: Record<AspectRatio, string> = {
  '16:9': 'h-4 w-7',
  '9:16': 'h-7 w-4',
  '1:1': 'h-5 w-5',
  adaptive: 'h-5 w-6 border-dashed',
};

/** The serial switch with its label and hint, shared by the create and edit dialogs. */
export function SerialField({
  checked,
  onCheckedChange,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('launcher.create');
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} label={t('serial')} />
        {t('serial')}
      </label>
      <p className="text-xs text-muted">{t('serialHint')}</p>
    </div>
  );
}

export function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('launcher.create');
  const tc = useTranslations('common');
  const tr = useTranslations('aspectRatio');
  const router = useRouter();
  const toastError = useToastError();
  const presets = useStylePresets();
  const create = useCreateDrama();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serial, setSerial] = useState(true);
  const [style, setStyle] = useState<string>();
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [touched, setTouched] = useState(false);

  const selectedStyle = style ?? presets.data?.[0]?.value;
  const preset = presets.data?.find((p) => p.value === selectedStyle);

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (!title.trim() || !selectedStyle) return;
    try {
      const drama = await create.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        serial,
        style: selectedStyle,
        aspectRatio,
      });
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setSerial(true);
      setTouched(false);
      router.push(`/drama/${drama.id}`);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent title={t('title')} description={t('description')}>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <Field label={t('name')} htmlFor="project-name" error={touched && !title.trim() ? t('nameRequired') : undefined}>
            <Input
              id="project-name"
              autoFocus
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </Field>
          <Field label={t('synopsis')} htmlFor="project-synopsis" hint={t('synopsisHint')}>
            <Textarea
              id="project-synopsis"
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('synopsisPlaceholder')}
              className="min-h-20"
            />
          </Field>
          <Field label={t('style')} htmlFor="project-style" hint={preset?.description}>
            <Select
              id="project-style"
              value={selectedStyle}
              onValueChange={setStyle}
              options={(presets.data ?? []).map((p) => ({ value: p.value, label: p.name }))}
              placeholder={t('stylePlaceholder')}
              disabled={presets.isLoading}
            />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-medium text-ink-2">{t('aspectRatio')}</legend>
            <div className="grid grid-cols-4 gap-2" role="radiogroup">
              {AspectRatioEnum.options.map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  role="radio"
                  aria-checked={aspectRatio === ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-md border px-2 py-3 text-xs transition-colors',
                    aspectRatio === ratio
                      ? 'border-accent bg-accent-soft text-accent-soft-ink'
                      : 'border-line text-ink-2 hover:border-line-strong',
                  )}
                >
                  <span className={cn('flex h-7 items-center')}>
                    <span className={cn('rounded-[2px] border-[1.5px] border-current', SHAPE[ratio])} />
                  </span>
                  <span className="font-medium">{tr(ratio)}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">{t('aspectRatioHint')}</p>
          </fieldset>
          <SerialField checked={serial} onCheckedChange={setSerial} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={create.isPending}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
