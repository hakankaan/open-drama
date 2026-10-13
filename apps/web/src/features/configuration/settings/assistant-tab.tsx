'use client';

import { Check, Copy, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tag } from '@/components/ui/tag';
import { useToastError } from '@/lib/errors';
import { useAssistantConnection, useRotateAssistantToken } from '../api';

/** A value with a copy button; `secret` hides it until asked. */
function Value({ value, label, secret = false }: { value: string; label: string; secret?: boolean }) {
  const t = useTranslations('settings.assistant');
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  const copy = () =>
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      toast.success(t('copied'));
      setTimeout(() => setCopied(false), 1500);
    });
  return (
    <div className="flex items-start gap-2">
      <code className="min-w-0 flex-1 rounded-md bg-surface-2 px-2 py-1.5 font-mono text-[13px] break-all" aria-label={label}>
        {shown ? value : '•'.repeat(Math.min(value.length, 43))}
      </code>
      {secret ? (
        <Button size="sm" variant="ghost" onClick={() => setShown((s) => !s)} aria-label={shown ? t('hide') : t('show')}>
          {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </Button>
      ) : null}
      <Button size="sm" variant="ghost" onClick={copy} aria-label={t('copy', { label })}>
        {copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      </Button>
    </div>
  );
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium tracking-wide text-muted uppercase">{term}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/**
 * Settings › Assistant (adr-0016): the endpoint, the bearer token and a ready-made connect command for an AI
 * assistant that speaks MCP, with the token's source and a rotate action. The token is fetched when this card is
 * opened and is never cached beyond the page.
 */
export function AssistantTab() {
  const t = useTranslations('settings.assistant');
  const tc = useTranslations('common');
  const toastError = useToastError();
  const { data, isPending, isError, refetch } = useAssistantConnection();
  const rotate = useRotateAssistantToken();
  const [confirming, setConfirming] = useState(false);

  const confirmRotate = () =>
    rotate.mutate(undefined, {
      onSuccess: () => {
        setConfirming(false);
        toast.success(t('rotated'));
      },
      onError: (err) => {
        setConfirming(false);
        toastError(err);
      },
    });

  const connectCommand = data?.token
    ? `claude mcp add --transport http open-drama ${data.endpoint} --header "Authorization: Bearer ${data.token}"`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-surface p-5" aria-labelledby="assistant-connection">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="assistant-connection" className="text-base font-semibold">
            {t('title')}
          </h2>
          {data ? <Tag tone={data.enabled ? 'success' : 'neutral'}>{data.enabled ? t('enabled') : t('disabled')}</Tag> : null}
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t('intro')}</p>
        {isPending ? (
          <div className="mt-4 flex flex-col gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ) : isError || !data ? (
          <div className="mt-4 flex items-center gap-3">
            <p className="text-sm text-danger" role="alert">
              {t('failed')}
            </p>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              {tc('retry')}
            </Button>
          </div>
        ) : !data.enabled ? (
          <p className="mt-4 max-w-2xl text-sm text-ink">{t('disabledBody')}</p>
        ) : (
          <dl className="mt-4 flex flex-col gap-4">
            <Row term={t('endpoint')}>
              <Value value={data.endpoint} label={t('endpoint')} />
            </Row>
            <Row term={t('token')}>
              <Value value={data.token ?? ''} label={t('token')} secret />
              <p className="mt-1 text-xs text-muted">{data.source === 'environment' ? t('sourceEnvironment') : t('sourceGenerated')}</p>
            </Row>
            {connectCommand ? (
              <Row term={t('connect')}>
                <Value value={connectCommand} label={t('connect')} secret />
                <p className="mt-1 text-xs text-muted">{t('connectNote')}</p>
              </Row>
            ) : null}
          </dl>
        )}
        {data?.enabled ? (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="sm" variant="secondary" onClick={() => setConfirming(true)} disabled={data.source === 'environment'}>
              {t('rotate')}
            </Button>
            {data.source === 'environment' ? <p className="text-xs text-muted">{t('rotateEnvironment')}</p> : null}
          </div>
        ) : null}
      </section>
      <section className="rounded-lg border border-warning/40 bg-warning-soft p-5" aria-labelledby="assistant-exposure">
        <h2 id="assistant-exposure" className="flex items-center gap-2 text-base font-semibold">
          <ShieldAlert className="h-4 w-4 text-warning" aria-hidden />
          {t('exposureTitle')}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink">{t('exposureBody')}</p>
      </section>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('rotateTitle')}
        description={t('rotateBody')}
        confirmLabel={t('rotate')}
        onConfirm={confirmRotate}
        pending={rotate.isPending}
      />
    </div>
  );
}
