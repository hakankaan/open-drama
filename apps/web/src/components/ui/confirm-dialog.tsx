'use client';

import { useTranslations } from 'next-intl';
import { Button } from './button';
import { Dialog, DialogContent, DialogFooter } from './dialog';

/** Confirmation for destructive or replacing actions. Stays open with a running state until `onConfirm` settles. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending,
  danger = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** For a confirm that itself cancels something, where a plain "Cancel" would read both ways. */
  cancelLabel?: string;
  onConfirm: () => void;
  pending?: boolean;
  danger?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent title={title} description={description}>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel ?? t('cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
