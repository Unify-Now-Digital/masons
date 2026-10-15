import { cn } from '@/shared/lib/utils';
import type { LeadChannel, LeadSource } from '@/shared/lib/leadSource';

/**
 * Source · channel chip (state, not action — BRAND.md "Status chip"). Neutral tint: a lead
 * source is not a status, so no status colour and never the terracotta accent.
 * Honest data: a missing value reads "not recorded".
 */
export function LeadSourcePill({ source, channel, className }: { source: LeadSource | null; channel: LeadChannel | null; className?: string }) {
  const known = !!source && source !== 'Unknown';
  const label = `${source ?? 'Source not recorded'}${channel ? ` · ${channel}` : ''}`;
  return (
    <span
      data-testid="lead-source-pill"
      title={`Lead source: ${source ?? 'not recorded'} · channel: ${channel ?? 'not recorded'}`}
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-full border px-2 text-[11px] font-semibold leading-[18px]',
        known ? 'border-gardens-bdr bg-gardens-page text-gardens-tx' : 'border-dashed border-gardens-bdr bg-transparent text-gardens-txm-aa',
        className,
      )}
    >
      {label}
    </span>
  );
}
