import { cn } from '@/shared/lib/utils';
import type { LeadChannel, LeadSource } from '@/shared/lib/leadSource';

/**
 * Source · channel chip (state, not action — BRAND.md "Status chip"). Neutral tint: a lead
 * source is not a status, so no status colour and never the terracotta accent.
 * Unknown source renders nothing. RAQ (and any other channel) only appears with a known source: "{source} · RAQ".
 */
export function LeadSourcePill({ source, channel, className }: { source: LeadSource | null; channel: LeadChannel | null; className?: string }) {
  if (!source || source === 'Unknown' || source.includes('Source not recorded')) return null;
  const label = channel ? `${source} · ${channel}` : source;
  return (
    <span
      data-testid="lead-source-pill"
      title={`Lead source: ${source}${channel ? ` · ${channel}` : ''}`}
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-full border border-gardens-bdr bg-gardens-page px-2 text-[11px] font-semibold leading-[18px] text-gardens-tx',
        className,
      )}
    >
      {label}
    </span>
  );
}
