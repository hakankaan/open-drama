import { CircleAlert, CircleCheck, CircleX } from 'lucide-react';
import type { ModelServiceProbe } from '@open-drama/contracts';
import { cn } from '@/lib/cn';

/** Outcome of a connectivity test: green only when the key was accepted. */
export function ProbeResult({ probe, className }: { probe: ModelServiceProbe; className?: string }) {
  const ok = probe.reachable && probe.keyAccepted !== false;
  const Icon = ok ? (probe.keyAccepted ? CircleCheck : CircleAlert) : CircleX;
  return (
    <p
      role="status"
      className={cn(
        'flex items-start gap-2 rounded-md px-3 py-2 text-[13px]',
        ok ? (probe.keyAccepted ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning') : 'bg-danger-soft text-danger',
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {probe.message}
        <span className="ml-1.5 opacity-70">({probe.latencyMs} ms)</span>
      </span>
    </p>
  );
}
