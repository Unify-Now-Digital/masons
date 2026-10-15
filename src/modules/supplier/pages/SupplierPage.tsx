import React, { useMemo } from 'react';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { supplierRollupFor, useSupplierBoard, useSupplierLinkDecision } from '../hooks/useSupplierBoard';
import { OrdersSupplierCell } from '../components/SupplierStatusLabel';
import { formatSupplierDate } from '../display';
import type { JobForRollup } from '../../../../supabase/functions/_shared/supplierStatus';

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header>
        <h1 className="font-head text-[22px] font-semibold text-gardens-tx">Supplier</h1>
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
                    <li key={job.id} className="flex items-center justify-between gap-2 text-[12.5px] text-gardens-txs">
                      <span className="min-w-0 truncate">{job.jobCode || job.customerReference || 'Job'}</span>
                      <span className="shrink-0">
                        {job.deliveryDate
                          ? formatSupplierDate(job.deliveryDate)
                          : job.deliveryEstimate
                            ? `est. ${job.deliveryEstimate}`
                            : 'est.'}
                      </span>
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
    </div>
  );
};
