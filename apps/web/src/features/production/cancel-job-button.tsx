'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { AgentJob } from '@open-drama/contracts';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ApiError } from '@/lib/api';
import { useToastError } from '@/lib/errors';
import { useCancelJob } from './api';

/**
 * Cancel for a running job, after a confirm. The request answers before the job settles, so the button stays busy
 * until the polled job is no longer running (and the caller stops showing it).
 */
export function CancelJobButton({ job, owner }: { job: AgentJob; owner: { episodeId: number } | { dramaId: number } }) {
  const t = useTranslations('jobs');
  const toastError = useToastError();
  const cancel = useCancelJob(owner);
  const [confirm, setConfirm] = useState(false);
  const [requested, setRequested] = useState<number | null>(null);

  const run = async () => {
    try {
      await cancel.mutateAsync(job.id);
      setRequested(job.id);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'CONFLICT') toast.info(t('notRunning'));
      else toastError(err);
    }
    setConfirm(false);
  };

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setConfirm(true)} loading={requested === job.id}>
        {requested === job.id ? null : <X className="h-3.5 w-3.5" aria-hidden />}
        {requested === job.id ? t('cancelling') : t('cancel')}
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('confirmTitle')}
        description={t('confirmBody')}
        confirmLabel={t('confirm')}
        cancelLabel={t('keep')}
        onConfirm={run}
        pending={cancel.isPending}
      />
    </>
  );
}
