'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { Drama } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/input';
import { useToastError } from '@/lib/errors';
import { useUpdateDrama } from '../api';
import { SerialField } from '../launcher/create-project-dialog';

/** Title, synopsis and the serial switch; the style and frame shape stay as created. */
export function EditProjectDialog({ drama, onClose }: { drama: Drama; onClose: () => void }) {
  const t = useTranslations('project.edit');
  const tl = useTranslations('launcher.create');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const update = useUpdateDrama();
  const [title, setTitle] = useState(drama.title);
  const [description, setDescription] = useState(drama.description);
  const [serial, setSerial] = useState(drama.serial);
  const [touched, setTouched] = useState(false);

  const submit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched(true);
    if (!title.trim()) return;
    try {
      await update.mutateAsync({ id: drama.id, title: title.trim(), description: description.trim(), serial });
      onClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent title={t('title')} description={t('description')}>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <Field label={tl('name')} htmlFor="edit-project-name" error={touched && !title.trim() ? tl('nameRequired') : undefined}>
            <Input id="edit-project-name" autoFocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label={tl('synopsis')} htmlFor="edit-project-synopsis" hint={tl('synopsisHint')}>
            <Textarea
              id="edit-project-synopsis"
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={tl('synopsisPlaceholder')}
              className="min-h-28"
            />
          </Field>
          <SerialField checked={serial} onCheckedChange={setSerial} disabled={update.isPending} />
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
              {tc('cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={update.isPending}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
