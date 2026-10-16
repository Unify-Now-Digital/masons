import React, { useMemo, useState } from 'react';
import { ClipboardList, Package } from 'lucide-react';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useOpenOrder } from '@/shared/context/orderPanel';
import { PANEL_PRIMARY } from '@/shared/components/panel/PanelChrome';
import { InfoList } from '@/shared/components/panel/InfoRow';
import { PanelSection } from '@/shared/components/panel/PanelSection';
import { SidePanel } from '@/shared/components/panel/SidePanel';
import { cn } from '@/shared/lib/utils';
import { supplierRollupFor, useSupplierBoard, useSupplierLinkDecision } from '../hooks/useSupplierBoard';
import { OrdersSupplierCell } from '../components/SupplierStatusLabel';
import { formatSupplierDate } from '../display';
import type { JobForRollup } from '../../../../supabase/functions/_shared/supplierStatus';

function statusText(value: string | null | undefined): string {
  if (!value) return '—';
  return value.replace(/_/g, ' ');
}

const SupplierJobPanel: React.FC<{ job: JobForRollup; orderId: string | null; onClose: () => void }> = ({ job, orderId, onClose }) => {
  const openOrder = useOpenOrder();
  const [open, setOpen] = useState<Record<string, boolean>>({ job: true, parts: true });
  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  const name = job.jobCode || job.customerReference || 'Supplier job';
  const delivery = job.deliveryDate
    ? formatSupplierDate(job.deliveryDate)
    : job.deliveryEstimate
      ? `est. ${job.deliveryEstimate}`
      : '—';
  return (
    <SidePanel
      mode="overlay"
      label={name}
      testId="supplier-job-panel"
      kicker="Supplier job"
      name={name}
      onClose={onClose}
      action={orderId ? (
        <button type="button" data-testid="panel-primary" className={PANEL_PRIMARY} onClick={() => openOrder(orderId)}>
          Open order
        </button>
      ) : undefined}
    >
      <PanelSection id="job" title="Job" icon={ClipboardList} open={open.job !== false} onToggle={toggle}>
        <InfoList
          rows={[
            { label: 'Batch', value: job.batchCode || '—' },
            { label: 'Job', value: job.jobCode || '—' },
            { label: 'Customer', value: job.customerReference || '—' },
            { label: 'Container', value: job.containerCode || '—' },
            { label: 'Status', value: statusText(job.normalizedStatus) },
            { label: 'Delivery', value: delivery },
          ]}
        />
      </PanelSection>
      <PanelSection id="parts" title="Parts" icon={Package} open={open.parts !== false} onToggle={toggle} aside={job.parts.length || undefined}>
        {job.parts.length === 0 ? (
          <p className="m-0 text-[13px] text-gardens-txs">No parts on this job.</p>
        ) : (
          <InfoList
            rows={job.parts.map((part, index) => ({
              label: part.description?.trim() || `Part ${index + 1}`,
              value: statusText(part.normalizedStatus),
            }))}
          />
        )}
      </PanelSection>
    </SidePanel>
  );
};

export const SupplierPage: React.FC = () => {
  const { organizationId } = useOrganization();
  const board = useSupplierBoard(organizationId);
  const decision = useSupplierLinkDecision();
  const batches = useMemo(() => {
    const groups = new Map<string, JobForRollup[]>();
    for (const job of board.jobs) {
      const key = job.batchCode || 'No batch';
      const list = groups.get(key) ?? [];
      list.push(job);
      groups.set(key, list);
    }
    return [...groups.entries()];
  }, [board.jobs]);
  const suggestions = board.links.filter((link) => link.linkStatus === 'suggested');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = board.jobs.find((job) => job.id === selectedId) ?? null;
  const selectedOrderId = selected
    ? (board.links.find((link) => link.jobId === selected.id && (link.linkStatus === 'confirmed' || link.linkStatus === 'auto'))
      ?? board.links.find((link) => link.jobId === selected.id && link.linkStatus !== 'rejected'))?.orderId ?? null
    : null;

  return (
    <div className={cn('mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 lg:p-6', selected && 'lg:pr-[436px]')}>
      <header>
        <h1 className="font-head text-[28px] font-semibold leading-tight text-gardens-tx">Suppliers</h1>
        <p className="m-0 mt-1 text-[13px] text-gardens-txs">
          Ogee jobs from the daily board read. Confirm a suggestion to show it on the order.
        </p>
      </header>
      {board.unavailable && (
        <p className="m-0 text-[13px] text-gardens-txs">The supplier board isn’t connected yet.</p>
      )}
      {!board.unavailable && !board.loaded && (
        <p className="m-0 text-[13px] text-gardens-txm">Checking the supplier board…</p>
      )}
      {board.loaded && (
        <>
          <section className="rounded-lg border border-gardens-bdr bg-gardens-surf">
            <h2 className="m-0 border-b border-gardens-bdr px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-gardens-txs">
              Batches
            </h2>
            {batches.length === 0 && <p className="m-0 px-3 py-3 text-[13px] text-gardens-txm">No jobs on the board yet.</p>}
            {batches.map(([batch, jobs]) => (
              <div key={batch} className="border-b border-gardens-bdr/70 px-3 py-2 last:border-b-0">
                <div className="text-[13px] font-semibold text-gardens-tx">{batch}</div>
                <ul className="m-0 mt-1 list-none space-y-1 p-0">
                  {jobs.map((job) => (
                    <li key={job.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(job.id)}
                        className={cn(
                          'flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-1 text-left text-[12.5px] text-gardens-txs hover:bg-gardens-page',
                          selectedId === job.id && 'bg-gardens-page',
                        )}
                      >
                        <span className="min-w-0 truncate">{job.jobCode || job.customerReference || 'Job'}</span>
                        <span className="shrink-0">
                          {job.deliveryDate
                            ? formatSupplierDate(job.deliveryDate)
                            : job.deliveryEstimate
                              ? `est. ${job.deliveryEstimate}`
                              : 'est.'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
          <section className="rounded-lg border border-gardens-bdr bg-gardens-surf">
            <h2 className="m-0 border-b border-gardens-bdr px-3 py-2 text-[12px] font-bold uppercase tracking-wide text-gardens-txs">
              Matches to review
            </h2>
            {suggestions.length === 0 && <p className="m-0 px-3 py-3 text-[13px] text-gardens-txm">Nothing waiting.</p>}
            {suggestions.map((link) => {
              const rollup = supplierRollupFor(board, link.orderId);
              return (
                <div key={link.id} className="flex flex-wrap items-center gap-2 border-b border-gardens-bdr/70 px-3 py-2 last:border-b-0">
                  <span className="min-w-0 flex-1 text-[12.5px] text-gardens-txs">{link.rule}</span>
                  <OrdersSupplierCell rollup={rollup} loaded compact />
                  <button
                    type="button"
                    className="h-11 rounded-md bg-gardens-acc px-3 text-[12px] font-semibold text-white"
                    onClick={() => decision.mutate({ linkId: link.id, decision: 'confirmed' })}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="h-11 rounded-md border border-gardens-bdr px-3 text-[12px] text-gardens-txs"
                    onClick={() => decision.mutate({ linkId: link.id, decision: 'rejected' })}
                  >
                    Reject
                  </button>
                </div>
              );
            })}
          </section>
        </>
      )}
      {selected && <SupplierJobPanel job={selected} orderId={selectedOrderId} onClose={() => setSelectedId(null)} />}
    </div>
  );
};
