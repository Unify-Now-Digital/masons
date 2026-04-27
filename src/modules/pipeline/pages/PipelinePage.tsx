import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Btn, Icon, Pill, AIBadge } from '@/shared/components/gardens';
import { useOrdersList } from '@/modules/orders/hooks/useOrders';
import { deriveOrderStage, ORDER_STAGES, ORDER_STAGE_LABEL, type OrderStage } from '@/shared/lib/orderStage';

const STAGE_ICON: Record<OrderStage, string> = {
  design: 'inscription',
  proof: 'doc',
  lettering: 'inscription',
  permit: 'stamp',
  install_ready: 'stone',
};

const STAGE_DESCRIPTION: Record<OrderStage, string> = {
  design: 'Proof not yet received from the customer — awaiting inscription details.',
  proof: 'Proof received, being drafted or in review.',
  lettering: 'Proof signed off, waiting on stone or lettering work in the yard.',
  permit: 'Waiting on cemetery permit — form sent, awaiting council approval.',
  install_ready: 'Stone in stock, permit approved, proof lettered. Ready to install.',
};

const currency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);

const compactDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const daysUntil = (iso: string | null) => {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const PipelinePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const orders = useOrdersList();

  const focusStage = searchParams.get('stage') as OrderStage | null;

  const byStage = useMemo(() => {
    const acc: Record<OrderStage, typeof orders.data> = {
      design: [],
      proof: [],
      lettering: [],
      permit: [],
      install_ready: [],
    } as never;
    for (const o of orders.data ?? []) {
      const stage = deriveOrderStage(o);
      acc[stage] = (acc[stage] ?? []).concat(o);
    }
    return acc;
  }, [orders.data]);

  const totalOpen = useMemo(() => ORDER_STAGES.reduce((sum, s) => sum + (byStage[s]?.length ?? 0), 0), [byStage]);

  const setFocus = (stage: OrderStage | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (stage) next.set('stage', stage);
      else next.delete('stage');
      return next;
    });
  };

  const stagesToShow: OrderStage[] = focusStage ? [focusStage] : ORDER_STAGES;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3">
          <h2 className="font-head text-xl sm:text-2xl font-semibold text-gardens-tx">Orders pipeline</h2>
          <span className="text-[12px] text-gardens-txs">
            {totalOpen} open · grouped by stage
          </span>
        </div>
        <Btn variant="secondary" size="sm" icon={<Icon name="arrowRight" size={11} />} onClick={() => navigate('/dashboard/orders')}>
          Orders table
        </Btn>
      </div>

      {/* Stage strip — same shape as Hub pipeline, always visible as nav */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {ORDER_STAGES.map((stage) => {
          const list = byStage[stage] ?? [];
          const active = focusStage === stage;
          return (
            <button
              key={stage}
              onClick={() => setFocus(active ? null : stage)}
              className="text-left"
              style={{
                background: active ? 'var(--g-acc-lt)' : 'var(--g-surf2)',
                border: `1px solid ${active ? 'var(--g-acc)' : 'var(--g-bdr)'}`,
                borderRadius: 8,
                padding: 12,
                cursor: 'pointer',
                transition: 'border-color .12s, background .12s',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center justify-center"
                  style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--g-page)', color: 'var(--g-txm)' }}
                >
                  <Icon name={STAGE_ICON[stage]} size={11} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gardens-txm">
                  {ORDER_STAGE_LABEL[stage]}
                </span>
              </div>
              <div className="font-head text-[28px] font-semibold text-gardens-tx leading-none">
                {list.length}
              </div>
              <div className="mt-2 text-[11px] text-gardens-txs min-h-[18px] truncate">
                {list.length === 0 ? 'Nothing here' : `${list.length} order${list.length === 1 ? '' : 's'}`}
              </div>
            </button>
          );
        })}
      </div>

      {focusStage && (
        <div className="flex items-center gap-2">
          <Pill tone="accent">Filtered: {ORDER_STAGE_LABEL[focusStage]}</Pill>
          <button
            type="button"
            onClick={() => setFocus(null)}
            className="text-[11px] text-gardens-txs hover:text-gardens-tx underline"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Stage detail cards */}
      <div className="flex flex-col gap-4">
        {stagesToShow.map((stage) => {
          const list = byStage[stage] ?? [];
          return (
            <Card key={stage} padded>
              <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-baseline gap-3">
                  <h3 className="font-head text-[15px] font-semibold text-gardens-tx m-0">
                    {ORDER_STAGE_LABEL[stage]}
                  </h3>
                  <span className="text-[11.5px] text-gardens-txs">{list.length} open</span>
                </div>
                <span className="text-[11px] text-gardens-txm italic max-w-full truncate">
                  {STAGE_DESCRIPTION[stage]}
                </span>
              </div>

              {orders.isLoading ? (
                <div className="text-[12px] text-gardens-txs">Loading…</div>
              ) : list.length === 0 ? (
                <div className="text-[12px] text-gardens-txs italic">No orders in this stage.</div>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'var(--g-bdr)' }}>
                  {list.map((o) => {
                    const due = daysUntil(o.installation_date);
                    const dueTone = due == null
                      ? 'neutral'
                      : due < 0
                        ? 'red'
                        : due < 7
                          ? 'amber'
                          : 'neutral';
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => navigate(`/dashboard/orders?order=${o.id}`)}
                        className="py-3 flex items-center gap-3 text-left hover:bg-gardens-page/50 transition-colors -mx-3 px-3 rounded-md"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-[11px] text-gardens-txm shrink-0">
                              OR-{o.order_number ?? '—'}
                            </span>
                            <span className="text-[13.5px] font-semibold text-gardens-tx truncate">
                              {o.customer_name || 'No customer'}
                            </span>
                            {o.person_name && o.person_name !== o.customer_name && (
                              <span className="text-[11.5px] text-gardens-txs truncate hidden sm:inline">
                                · {o.person_name}
                              </span>
                            )}
                          </div>
                          <div className="text-[11.5px] text-gardens-txs truncate">
                            {o.sku || '—'}
                            {o.installation_date && (
                              <span className="ml-2">
                                Install {compactDate(o.installation_date)}
                                {due != null && ` · ${due >= 0 ? `in ${due}d` : `${Math.abs(due)}d overdue`}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <Pill tone={dueTone as never}>
                          {due == null ? 'No date' : due >= 0 ? `${due}d` : `${Math.abs(due)}d late`}
                        </Pill>
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-gardens-txm">
        <AIBadge label="PIPELINE · LIVE" size="sm" variant="ghost" />
        <span>
          Stage derived from stone, proof and permit status. Click any order to open its sidebar.
        </span>
      </div>
    </div>
  );
};
