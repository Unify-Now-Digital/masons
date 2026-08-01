import type { ReactNode } from 'react';

interface PipelineColumnProps {
  label: string;
  count: number;
  children: ReactNode;
}

export function PipelineColumn({ label, count, children }: PipelineColumnProps) {
  return (
    <div className="flex flex-col rounded-lg border border-gardens-bdr bg-gardens-page/60 min-h-[320px] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gardens-bdr bg-gardens-sidebar/40">
        <span className="text-xs font-semibold uppercase tracking-wide text-gardens-txs">{label}</span>
        <span className="text-[11px] font-medium tabular-nums text-gardens-txm">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">{children}</div>
    </div>
  );
}
