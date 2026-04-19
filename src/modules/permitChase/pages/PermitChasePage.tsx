import React, { useMemo, useState } from 'react';
import { Card, Pill, Btn, Icon, AIBadge, AISuggestion } from '@/shared/components/gardens';
import { usePermitsPipeline } from '../hooks/usePermitChase';
import {
  PERMIT_STAGES,
  PERMIT_STAGE_LABEL,
  type PermitOrder,
  type PermitSla,
  type PermitStage,
  zoneFor,
  type SlaZone,
} from '../api/permitChase.api';

type View = 'pipeline' | PermitStage | 'table';

const ZONE_TONE: Record<SlaZone, 'green' | 'neutral' | 'amber' | 'red'> = {
  ok: 'green',
  warn: 'neutral',
  amber: 'amber',
  red: 'red',
};

const ZONE_LABEL: Record<SlaZone, string> = {
  ok: 'On track',
  warn: 'Approaching',
  amber: 'Warning',
  red: 'Overdue',
};

export const PermitChasePage: React.FC = () => {
  const pipeline = usePermitsPipeline();
  const [view, setView] = useState<View>('pipeline');
  const [filter, setFilter] = useState<'all' | 'alerts'>('all');

  const data = pipeline.data;
  const orders = useMemo(() => data?.orders ?? [], [data]);
  const slas = useMemo(() => data?.slas ?? {}, [data]);

  const byStage = useMemo(() => {
    const out: Record<PermitStage, PermitOrder[]> = {
      form_needed: [],
      with_customer: [],
      completing: [],
      submitted: [],
      approved: [],
    };
    for (const o of orders) out[o.stage].push(o);
    return out;
  }, [orders]);

  const stageCounts = PERMIT_STAGES.map((s) => {
    const list = byStage[s];
    const alerts = list.filter((o) => {
      const z = zoneFor(o.daysInStage, slas[s]);
      return z.zone === 'amber' || z.zone === 'red';
    }).length;
    return { id: s, label: PERMIT_STAGE_LABEL[s], count: list.length, alerts };
  });

  return (
    <div className="flex flex-col gap-4">
      {data && data.totalAlerts > 0 && (
        <AISuggestion
          prominent
          title={`${data.totalAlerts} permit${data.totalAlerts === 1 ? '' : 's'} need${data.totalAlerts === 1 ? 's' : ''} attention`}
          body="Stages turning amber or red against their SLA. Address the longest dwellers first."
          actions={
            <Btn variant="ai" size="sm" onClick={() => setFilter('alerts')}>
              Show alerts only
            </Btn>
          }
        />
      )}

      {/* View tabs + filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div
          className="flex items-center gap-0.5 p-[3px] rounded-[7px] border border-gardens-bdr bg-gardens-surf overflow-x-auto"
          style={{ maxWidth: '100%' }}
        >
          <TabBtn label="Pipeline" icon="grip" active={view === 'pipeline'} onClick={() => setView('pipeline')} />
          {stageCounts.map((s) => (
            <TabBtn
              key={s.id}
              label={`${s.label}`}
              count={s.count}
              alerts={s.alerts}
              active={view === s.id}
              onClick={() => setView(s.id)}
            />
          ))}
          <TabBtn label="All" icon="menu" active={view === 'table'} onClick={() => setView('table')} />
        </div>
        <div className="flex-1" />
        {(view === 'pipeline' || view === 'table') && (
          <div className="flex gap-1.5 flex-wrap">
            <FilterChip label={`All ${orders.length}`} active={filter === 'all'} onClick={() => setFilter('all')} />
            <FilterChip
              label={`${data?.totalAlerts ?? 0} need attention`}
              active={filter === 'alerts'}
              onClick={() => setFilter('alerts')}
              tone="red"
            />
          </div>
        )}
      </div>

      {pipeline.isLoading ? (
        <Card padded>
          <div className="text-[12px] text-gardens-txs">Loading permits…</div>
        </Card>
      ) : view === 'pipeline' ? (
        <PipelineView byStage={byStage} slas={slas} filter={filter} onJumpStage={(s) => setView(s)} />
      ) : view === 'table' ? (
        <FlatTable orders={orders} slas={slas} filter={filter} />
      ) : (
        <StageDetail stage={view} orders={byStage[view]} sla={slas[view]} />
      )}

      <div className="flex items-center gap-2 text-[11px] text-gardens-txm">
        <AIBadge label="PERMITS · LIVE" size="sm" variant="ghost" />
        <span>
          5-stage pipeline derived from `order_permits.permit_phase`. Dwell-time bars use
          per-organization `workflow_slas`.
        </span>
      </div>
    </div>
  );
};

interface TabBtnProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: string;
  count?: number;
  alerts?: number;
}

const TabBtn: React.FC<TabBtnProps> = ({ label, active, onClick, icon, count, alerts }) => (
  <button
    onClick={onClick}
    style={{
      padding: '5px 11px',
      border: 'none',
      borderRadius: 5,
      cursor: 'pointer',
      background: active ? 'var(--g-page)' : 'transparent',
      color: active ? 'var(--g-tx)' : 'var(--g-txs)',
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    }}
  >
    {icon && <Icon name={icon} size={11} />}
    {label}
    {count != null && (
      <span style={{ opacity: 0.6, marginLeft: 2 }}>{count}</span>
    )}
    {!!alerts && alerts > 0 && (
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--g-red)',
          marginLeft: 2,
        }}
      />
    )}
  </button>
);

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: 'red';
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick, tone }) => {
  const activeBg = tone === 'red' ? 'var(--g-red-lt)' : 'var(--g-acc-lt)';
  const activeFg = tone === 'red' ? 'var(--g-red-dk)' : 'var(--g-acc-dk)';
  const activeBorder = tone === 'red' ? 'var(--g-red)' : 'var(--g-acc)';
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 10px',
        borderRadius: 14,
        border: `1px solid ${active ? activeBorder : 'var(--g-bdr)'}`,
        background: active ? activeBg : 'var(--g-surf)',
        color: active ? activeFg : 'var(--g-txs)',
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
};

const PipelineView: React.FC<{
  byStage: Record<PermitStage, PermitOrder[]>;
  slas: Partial<Record<PermitStage, PermitSla>>;
  filter: 'all' | 'alerts';
  onJumpStage: (s: PermitStage) => void;
}> = ({ byStage, slas, filter, onJumpStage }) => (
  <div
    className="grid gap-3 overflow-x-auto"
    style={{ gridTemplateColumns: 'repeat(5, minmax(240px, 1fr))' }}
  >
    {PERMIT_STAGES.map((stage) => {
      const list = byStage[stage].filter((o) => {
        if (filter !== 'alerts') return true;
        const z = zoneFor(o.daysInStage, slas[stage]);
        return z.zone === 'amber' || z.zone === 'red';
      });
      return (
        <div key={stage} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <button
              onClick={() => onJumpStage(stage)}
              className="text-left flex items-center gap-2"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-gardens-txm">
                {PERMIT_STAGE_LABEL[stage]}
              </span>
              <Pill tone="neutral">{list.length}</Pill>
            </button>
          </div>
          {list.length === 0 ? (
            <div
              className="text-[11px] text-gardens-txm italic p-3 rounded-md text-center"
              style={{ background: 'var(--g-surf2)', border: '1px dashed var(--g-bdr)' }}
            >
              Empty
            </div>
          ) : (
            list.map((order) => (
              <PermitCard key={order.permitId} order={order} sla={slas[stage]} />
            ))
          )}
        </div>
      );
    })}
  </div>
);

const PermitCard: React.FC<{ order: PermitOrder; sla?: PermitSla }> = ({ order, sla }) => {
  const z = zoneFor(order.daysInStage, sla);
  const tone = ZONE_TONE[z.zone];
  return (
    <Card padded={false} style={{ padding: 11 }}>
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-semibold text-gardens-tx truncate">
            {order.customerName}
          </div>
          <div
            className="text-[10.5px] text-gardens-txs truncate"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            OR-{order.orderNumber ?? '—'}
          </div>
        </div>
        <Pill tone={tone} dot={z.zone === 'red'}>
          {order.daysInStage}d
        </Pill>
      </div>
      <DwellBar zone={z.zone} pct={z.pct} />
      <div className="text-[11px] text-gardens-txs mt-2 truncate">
        {order.cemetery} · {order.council ?? 'No council'}
      </div>
      {order.stage === 'completing' && (
        <SpecsRow specs={order.specs} />
      )}
      {order.stage === 'form_needed' && (
        <div className="mt-2">
          {order.formStatus === 'matched' ? (
            <Pill tone="green">Form on file</Pill>
          ) : (
            <Pill tone="red" dot>Form missing</Pill>
          )}
        </div>
      )}
      {order.stage === 'with_customer' && order.sentVia && (
        <div className="mt-2 text-[10.5px] text-gardens-txm italic">Sent via {order.sentVia}</div>
      )}
    </Card>
  );
};

const DwellBar: React.FC<{ zone: SlaZone; pct: number }> = ({ zone, pct }) => {
  const fg =
    zone === 'red' ? 'var(--g-red)' : zone === 'amber' ? 'var(--g-amb)' : zone === 'warn' ? 'var(--g-txm)' : 'var(--g-grn)';
  return (
    <div
      style={{
        height: 5,
        borderRadius: 3,
        background: 'var(--g-page)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(2, pct))}%`,
          height: '100%',
          background: fg,
          transition: 'width .2s',
        }}
      />
    </div>
  );
};

const SPEC_LABELS: Array<keyof PermitOrder['specs']> = [
  'inscription',
  'material',
  'dimensions',
  'fixings',
  'plot',
];

const SpecsRow: React.FC<{ specs: PermitOrder['specs'] }> = ({ specs }) => (
  <div className="mt-2 flex items-center gap-1">
    {SPEC_LABELS.map((k) => (
      <span
        key={k}
        title={k}
        style={{
          width: 14,
          height: 14,
          borderRadius: 4,
          background: specs[k] ? 'var(--g-grn-lt)' : 'var(--g-page)',
          border: `1px solid ${specs[k] ? 'var(--g-grn)' : 'var(--g-bdr)'}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: specs[k] ? 'var(--g-grn-dk)' : 'var(--g-txm)',
        }}
      >
        {specs[k] ? <Icon name="check" size={9} stroke={2.5} /> : null}
      </span>
    ))}
  </div>
);

const StageDetail: React.FC<{
  stage: PermitStage;
  orders: PermitOrder[];
  sla?: PermitSla;
}> = ({ stage, orders, sla }) => (
  <Card padded>
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="font-head text-[17px] font-semibold text-gardens-tx m-0">
          {PERMIT_STAGE_LABEL[stage]}
        </h3>
        <div className="text-[11.5px] text-gardens-txs">
          {STAGE_HINT[stage]}{' '}
          {sla && (
            <span className="text-gardens-txm italic">
              · target {sla.target}d · max {sla.max}d
            </span>
          )}
        </div>
      </div>
      <Pill tone="neutral">{orders.length}</Pill>
    </div>
    {orders.length === 0 ? (
      <div className="text-[12px] text-gardens-txs">Nothing in this stage right now.</div>
    ) : (
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--g-bdr)' }}>
        {orders.map((o) => (
          <StageRow key={o.permitId} order={o} sla={sla} />
        ))}
      </div>
    )}
  </Card>
);

const STAGE_HINT: Record<PermitStage, string> = {
  form_needed: 'Locate the right form, or research the cemetery contact and request one.',
  with_customer: 'Paperwork is with the customer — chase if it has been silent too long.',
  completing: 'Fill the memorial specs (5 fields) before submitting to the cemetery.',
  submitted: 'With the council. Chase if it has been past their average.',
  approved: 'Hand off to installs.',
};

const StageRow: React.FC<{ order: PermitOrder; sla?: PermitSla }> = ({ order, sla }) => {
  const z = zoneFor(order.daysInStage, sla);
  return (
    <div className="py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-[13.5px] font-semibold text-gardens-tx truncate">{order.customerName}</span>
          <span
            className="text-[10.5px] text-gardens-txm"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            OR-{order.orderNumber ?? '—'}
          </span>
          <Pill tone={ZONE_TONE[z.zone]} dot={z.zone === 'red'}>
            {order.daysInStage}d · {ZONE_LABEL[z.zone]}
          </Pill>
        </div>
        <div className="text-[11.5px] text-gardens-txs truncate">
          {order.cemetery} · {order.council ?? 'No council'}
        </div>
      </div>
      <Btn variant="secondary" size="sm">
        Action
      </Btn>
    </div>
  );
};

const FlatTable: React.FC<{
  orders: PermitOrder[];
  slas: Partial<Record<PermitStage, PermitSla>>;
  filter: 'all' | 'alerts';
}> = ({ orders, slas, filter }) => {
  const filtered = orders.filter((o) => {
    if (filter !== 'alerts') return true;
    const z = zoneFor(o.daysInStage, slas[o.stage]);
    return z.zone === 'amber' || z.zone === 'red';
  });
  return (
    <Card padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--g-page)' }}>
              {['Customer', 'Order', 'Cemetery', 'Stage', 'Days', 'Zone', ''].map((h) => (
                <th
                  key={h}
                  className="text-left px-3 py-2 text-[10.5px] uppercase tracking-[0.06em] text-gardens-txm font-semibold"
                  style={{ borderBottom: '1px solid var(--g-bdr)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-6 text-gardens-txs">
                  No permits match this filter.
                </td>
              </tr>
            ) : (
              filtered.map((o) => {
                const z = zoneFor(o.daysInStage, slas[o.stage]);
                return (
                  <tr key={o.permitId} style={{ borderBottom: '1px solid var(--g-bdr)' }}>
                    <td className="px-3 py-2 font-semibold text-gardens-tx">{o.customerName}</td>
                    <td className="px-3 py-2" style={{ fontFamily: 'ui-monospace, monospace' }}>
                      OR-{o.orderNumber ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-gardens-txs">{o.cemetery}</td>
                    <td className="px-3 py-2">
                      <Pill tone="neutral">{PERMIT_STAGE_LABEL[o.stage]}</Pill>
                    </td>
                    <td className="px-3 py-2" style={{ fontFamily: 'ui-monospace, monospace' }}>
                      {o.daysInStage}d
                    </td>
                    <td className="px-3 py-2">
                      <Pill tone={ZONE_TONE[z.zone]} dot={z.zone === 'red'}>
                        {ZONE_LABEL[z.zone]}
                      </Pill>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Btn variant="ghost" size="sm">Open</Btn>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
