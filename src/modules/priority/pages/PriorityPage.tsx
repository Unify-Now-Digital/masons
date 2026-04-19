import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Pill, Btn, Icon, AIBadge, AISuggestion } from '@/shared/components/gardens';
import { usePriorityQueue } from '../hooks/usePriority';
import type {
  PriorityItem,
  PrioritySeverity,
  PrioritySource,
  PriorityRoute,
} from '../api/priority.api';

type Filter = 'all' | 'high' | 'ai' | 'manual';

const ROUTE_PATH: Record<PriorityRoute, string> = {
  finance: '/dashboard/finance',
  proofs: '/dashboard/inbox',
  permits: '/dashboard/permit-tracker',
  orders: '/dashboard/orders',
  hub: '/dashboard/hub',
};

const SEVERITY_TONE: Record<PrioritySeverity, 'red' | 'amber'> = {
  high: 'red',
  med: 'amber',
};

const SOURCE_TONE: Record<PrioritySource, 'accent' | 'neutral'> = {
  ai: 'accent',
  manual: 'neutral',
};

const currency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);

export const PriorityPage: React.FC = () => {
  const queue = usePriorityQueue();
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const data = queue.data ?? [];
    return {
      all: data.length,
      high: data.filter((i) => i.severity === 'high').length,
      ai: data.filter((i) => i.source === 'ai').length,
      manual: data.filter((i) => i.source === 'manual').length,
    };
  }, [queue.data]);

  const visible = useMemo(() => {
    const data = queue.data ?? [];
    switch (filter) {
      case 'high':
        return data.filter((i) => i.severity === 'high');
      case 'ai':
        return data.filter((i) => i.source === 'ai');
      case 'manual':
        return data.filter((i) => i.source === 'manual');
      default:
        return data;
    }
  }, [queue.data, filter]);

  return (
    <div className="flex flex-col gap-4">
      {queue.data && queue.data.length > 0 && (
        <AISuggestion
          prominent
          title={`${counts.high} urgent item${counts.high === 1 ? '' : 's'} need action`}
          body={`Mason pulled signals from balances, proofs, permits and overdue orders into one ranked list so nothing quiet slips through.`}
          actions={
            counts.high > 0 ? (
              <Btn variant="ai" size="sm" onClick={() => setFilter('high')}>
                Show high severity only
              </Btn>
            ) : undefined
          }
        />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip label={`All (${counts.all})`} active={filter === 'all'} onClick={() => setFilter('all')} />
        <FilterChip
          label={`High (${counts.high})`}
          active={filter === 'high'}
          onClick={() => setFilter('high')}
          tone="red"
        />
        <FilterChip label={`AI-flagged (${counts.ai})`} active={filter === 'ai'} onClick={() => setFilter('ai')} />
        <FilterChip
          label={`Manual (${counts.manual})`}
          active={filter === 'manual'}
          onClick={() => setFilter('manual')}
        />
      </div>

      {queue.isLoading ? (
        <Card padded>
          <div className="text-[12px] text-gardens-txs">Loading priority queue…</div>
        </Card>
      ) : visible.length === 0 ? (
        <Card padded>
          <div className="text-[13px] text-gardens-txs">
            {counts.all === 0
              ? 'Nothing needs chasing right now. Go outside.'
              : 'No items match this filter.'}
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((item) => (
            <PriorityRow key={item.key} item={item} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-gardens-txm">
        <AIBadge label="AI · LIVE" size="sm" variant="ghost" />
        <span>
          Signals: balance ≤ 21d to install · proofs silent 5d+ · permits past SLA · overdue orders ·
          manual high-priority flag.
        </span>
      </div>
    </div>
  );
};

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
        padding: '5px 12px',
        borderRadius: 14,
        border: `1px solid ${active ? activeBorder : 'var(--g-bdr)'}`,
        background: active ? activeBg : 'var(--g-surf)',
        color: active ? activeFg : 'var(--g-txs)',
        fontFamily: 'var(--g-ff-body)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
};

const PriorityRow: React.FC<{ item: PriorityItem }> = ({ item }) => {
  const navigate = useNavigate();
  return (
    <Card
      padded
      style={{
        padding: 14,
        borderLeft: `3px solid ${item.severity === 'high' ? 'var(--g-red)' : 'var(--g-amb)'}`,
      }}
    >
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Pill tone={SEVERITY_TONE[item.severity]} dot>
              {item.severity}
            </Pill>
            <Pill tone={SOURCE_TONE[item.source]}>
              {item.source === 'ai' ? 'AI' : 'Manual'}
            </Pill>
            <span className="text-[13.5px] font-semibold text-gardens-tx">{item.customerName}</span>
            <span
              className="text-[10.5px] text-gardens-txm"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            >
              OR-{item.orderNumber ?? '—'}
            </span>
            <span className="text-[10.5px] text-gardens-txm italic">{item.age}</span>
            {item.value != null && item.value > 0 && (
              <span
                className="text-[10.5px] text-gardens-txm"
                style={{ fontFamily: 'ui-monospace, monospace' }}
              >
                {currency(item.value)}
              </span>
            )}
          </div>
          <div className="font-head text-[15px] font-semibold text-gardens-tx mb-1">
            {item.headline}
          </div>
          <div className="text-[12.5px] text-gardens-txs leading-snug mb-1">{item.rationale}</div>
          <div className="text-[11.5px] text-gardens-txm italic">→ {item.nextStep}</div>
        </div>
        <div className="flex items-start gap-2">
          <Btn
            variant="primary"
            size="sm"
            icon={<Icon name="arrowRight" size={11} />}
            onClick={() => navigate(ROUTE_PATH[item.route])}
          >
            {item.nextAction}
          </Btn>
        </div>
      </div>
    </Card>
  );
};
