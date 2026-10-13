import type { ReactNode } from 'react';

interface PipelineColumnProps {
  label: string;
  count: number;
  /** pipeline-v1 two-line header: value line, then weighted* + quiet rule. */
  valueLine?: ReactNode;
  ruleLine?: ReactNode;
  children: ReactNode;
}

export function PipelineColumn({ label, count, valueLine, ruleLine, children }: PipelineColumnProps) {
  return (
    <div className="flex flex-col rounded-[10px] border border-gardens-bdr bg-gardens-page min-h-[320px] overflow-hidden">
      <div className="px-3 py-2 border-b border-gardens-bdr bg-gardens-surf">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-gardens-tx">{label}</span>
          <span className="text-[12px] font-semibold tabular-nums text-gardens-txs">{count}</span>
        </div>
        {valueLine && <div className="text-[13px] text-gardens-tx truncate">{valueLine}</div>}
        {ruleLine && <div className="text-[11px] text-gardens-txm-aa truncate">{ruleLine}</div>}
      </div>
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 scrollbar-hide">{children}</div>
    </div>
  );
}
