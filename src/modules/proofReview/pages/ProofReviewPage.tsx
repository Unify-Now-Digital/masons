import React, { useEffect, useMemo, useState } from 'react';
import { Card, Pill, Btn, Icon, AIBadge, AISuggestion } from '@/shared/components/gardens';
import { useProofPayload } from '../hooks/useProofReview';
import type { ProofCheck, ProofItem } from '../api/proofReview.api';

const compactDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const ProofReviewPage: React.FC = () => {
  const payload = useProofPayload();
  const queue = useMemo(() => payload.data?.queue ?? [], [payload.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = queue.find((p) => p.id === selectedId) ?? queue[0];

  useEffect(() => {
    if (queue.length && !selected) setSelectedId(queue[0].id);
  }, [queue, selected]);

  return (
    <div className="flex flex-col gap-4">
      <StatsStrip
        loading={payload.isLoading}
        totals={payload.data?.totals}
        targetDays={payload.data?.targetDays}
      />

      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: '300px 1fr 320px', minHeight: 600 }}
      >
        <Queue
          loading={payload.isLoading}
          items={queue}
          selectedId={selected?.id ?? null}
          onSelect={(id) => setSelectedId(id)}
          targetDays={payload.data?.targetDays ?? 3}
        />
        <Centerpiece proof={selected} />
        <RightRail proof={selected} />
      </div>

      {payload.data && payload.data.recentlyApproved.length > 0 && (
        <RecentLog proofs={payload.data.recentlyApproved} />
      )}

      <div className="flex items-center gap-2 text-[11px] text-gardens-txm">
        <AIBadge label="PROOFS · LIVE" size="sm" variant="ghost" />
        <span>
          Queue sorted by time since inscription received. AI checks are evaluated per render.
        </span>
      </div>
    </div>
  );
};

interface StatsStripProps {
  loading: boolean;
  totals?: { drafting: number; awaiting: number; approvedThisMonth: number; overdue: number };
  targetDays?: number;
}

const StatsStrip: React.FC<StatsStripProps> = ({ loading, totals, targetDays }) => {
  const tiles = [
    { label: 'Drafting', value: totals?.drafting ?? '—', sub: 'no proof sent yet', icon: 'inscription' },
    { label: 'Awaiting customer', value: totals?.awaiting ?? '—', sub: 'sent, no reply', icon: 'clock' },
    { label: 'Overdue', value: totals?.overdue ?? '—', sub: `over target ${targetDays ?? '—'}d`, icon: 'alert', tone: 'amber' as const },
    { label: 'Approved this month', value: totals?.approvedThisMonth ?? '—', sub: 'cleared for workshop', icon: 'check', tone: 'green' as const },
  ];
  if (loading) {
    return (
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {tiles.map((_, i) => (
          <Card key={i} padded style={{ height: 92 }}>
            <div className="text-[12px] text-gardens-txs">…</div>
          </Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </div>
  );
};

const StatTile: React.FC<{
  label: string;
  value: number | string;
  sub: string;
  icon: string;
  tone?: 'amber' | 'green';
}> = ({ label, value, sub, icon, tone }) => {
  const bg = tone === 'amber' ? 'var(--g-amb-lt)' : tone === 'green' ? 'var(--g-grn-lt)' : 'var(--g-surf2)';
  const fg = tone === 'amber' ? 'var(--g-amb-dk)' : tone === 'green' ? 'var(--g-grn-dk)' : 'var(--g-txm)';
  return (
    <Card padded style={{ padding: 13 }}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex items-center justify-center"
          style={{ width: 22, height: 22, borderRadius: 6, background: bg, color: fg }}
        >
          <Icon name={icon} size={11} />
        </span>
        <div className="text-[11px] font-semibold text-gardens-txs">{label}</div>
      </div>
      <div className="font-head text-[24px] font-semibold text-gardens-tx leading-none">{value}</div>
      <div className="mt-2 text-[10.5px] text-gardens-txm italic truncate">{sub}</div>
    </Card>
  );
};

interface QueueProps {
  loading: boolean;
  items: ProofItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  targetDays: number;
}

const Queue: React.FC<QueueProps> = ({ loading, items, selectedId, onSelect, targetDays }) => (
  <Card padded={false} className="flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
    <div className="px-3 py-2.5 border-b border-gardens-bdr">
      <div className="flex items-baseline justify-between">
        <div className="text-[12px] font-semibold text-gardens-tx">Proof queue</div>
        <div
          className="text-[10px] text-gardens-txm"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        >
          {items.length} active
        </div>
      </div>
      <div className="text-[10.5px] text-gardens-txs mt-1 leading-tight">
        Sorted by time since inscription received · target {targetDays}d to first proof
      </div>
    </div>
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="p-3 text-[12px] text-gardens-txs">Loading…</div>
      ) : items.length === 0 ? (
        <div className="p-3 text-[12px] text-gardens-txs">
          No active proofs. New ones appear here as inscriptions are received.
        </div>
      ) : (
        items.map((p) => (
          <QueueRow key={p.id} proof={p} active={p.id === selectedId} onClick={() => onSelect(p.id)} />
        ))
      )}
    </div>
  </Card>
);

const QueueRow: React.FC<{ proof: ProofItem; active: boolean; onClick: () => void }> = ({
  proof,
  active,
  onClick,
}) => {
  const pending = !proof.sentAt;
  const tone = proof.isOverdue ? 'red' : proof.isApproaching ? 'amber' : pending ? 'blue' : 'neutral';
  const label = pending
    ? `${proof.daysSinceInscription ?? 0}d since inscription`
    : `Sent ${proof.daysSinceSent ?? 0}d ago`;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '11px 12px',
        textAlign: 'left',
        background: active ? 'var(--g-acc-lt)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--g-bdr)',
        borderLeft: active ? '3px solid var(--g-acc)' : '3px solid transparent',
        cursor: 'pointer',
      }}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-head text-[13px] font-semibold text-gardens-tx truncate flex-1">
          {proof.customerName}
        </span>
        <span
          className="text-[10px] text-gardens-txs"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        >
          v{proof.version || '—'}
        </span>
      </div>
      <div
        className="text-[10.5px] text-gardens-txs truncate"
        style={{ fontFamily: 'ui-monospace, monospace' }}
      >
        OR-{proof.orderNumber ?? '—'}
      </div>
      <div className="mt-2 flex items-center gap-1 flex-wrap">
        <Pill tone={tone} dot={proof.isOverdue}>
          {label}
        </Pill>
        {proof.aiChecks.some((c) => c.level === 'warn' || c.level === 'fail') && (
          <Pill tone="amber">AI flag</Pill>
        )}
      </div>
    </button>
  );
};

const Centerpiece: React.FC<{ proof?: ProofItem }> = ({ proof }) => {
  if (!proof) {
    return (
      <Card padded>
        <div className="text-[12px] text-gardens-txs">Select a proof from the queue to review.</div>
      </Card>
    );
  }
  const lines = (proof.inscriptionText ?? '').split(/\n/).filter(Boolean);
  return (
    <Card padded={false} className="flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
      <div className="px-4 py-3 border-b border-gardens-bdr flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-head text-[16px] font-semibold text-gardens-tx truncate">
            {proof.customerName}
          </div>
          <div
            className="text-[11px] text-gardens-txs"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            OR-{proof.orderNumber ?? '—'} · v{proof.version || '—'} · {proof.state.replace(/_/g, ' ')}
          </div>
        </div>
        <Btn variant="secondary" size="sm" icon={<Icon name="undo" size={11} />}>
          Edit
        </Btn>
        <Btn variant="primary" size="sm" icon={<Icon name="check" size={11} stroke={2.2} />}>
          Approve
        </Btn>
      </div>

      {/* Granite stage preview */}
      <div className="p-6 flex items-center justify-center" style={{ background: 'var(--g-page)' }}>
        <div
          className="rounded-md p-8 flex flex-col items-center gap-2 text-center max-w-[420px] w-full shadow-sm"
          style={{
            background:
              'linear-gradient(180deg, #d6cfc1 0%, #b9b0a0 50%, #8c8576 100%)',
            color: '#1a1815',
            minHeight: 280,
          }}
        >
          {lines.length === 0 ? (
            <div className="font-head italic text-gardens-txs">Inscription not yet provided</div>
          ) : (
            lines.map((line, i) => (
              <div
                key={i}
                className="font-head"
                style={{
                  fontSize: i === 1 ? 18 : 15,
                  fontWeight: i === 1 ? 700 : 500,
                  letterSpacing: i === 1 ? '0.05em' : '0.01em',
                  textTransform: i === 1 ? 'uppercase' : 'none',
                }}
              >
                {line}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Version history */}
      <div className="px-4 py-3 border-t border-gardens-bdr">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-gardens-txm mb-2">
          Version history
        </div>
        {proof.versions.length === 0 ? (
          <div className="text-[12px] text-gardens-txs">
            No history recorded yet. Events will appear as the proof progresses.
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {proof.versions.map((v) => (
              <li key={v.id} className="flex items-center gap-2 text-[12px]">
                <span
                  className="inline-flex items-center justify-center font-bold text-[10px]"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--g-page)',
                    color: 'var(--g-acc-dk)',
                    border: '1px solid var(--g-bdr)',
                  }}
                >
                  v{v.version}
                </span>
                <span className="font-semibold text-gardens-tx">{v.event.replace(/_/g, ' ')}</span>
                <span className="text-gardens-txs">· {v.actor}</span>
                <span
                  className="text-gardens-txm"
                  style={{ fontFamily: 'ui-monospace, monospace' }}
                >
                  {compactDate(v.createdAt)}
                </span>
                {v.note && <span className="text-gardens-txs italic truncate">— {v.note}</span>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  );
};

const CHECK_TONE: Record<string, 'green' | 'neutral' | 'amber' | 'red'> = {
  pass: 'green',
  info: 'neutral',
  warn: 'amber',
  fail: 'red',
};

const RightRail: React.FC<{ proof?: ProofItem }> = ({ proof }) => {
  if (!proof) {
    return (
      <Card padded>
        <div className="text-[12px] text-gardens-txs">No proof selected.</div>
      </Card>
    );
  }
  return (
    <Card padded={false} className="flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gardens-bdr flex items-center gap-2">
        <AIBadge label="PRE-FLIGHT" size="sm" variant="ghost" />
        <div className="font-head text-[14px] font-semibold text-gardens-tx">AI checks</div>
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1 overflow-y-auto">
        {proof.aiChecks.length === 0 ? (
          <div className="text-[12px] text-gardens-txs">
            No AI checks recorded yet. They appear when a render is generated.
          </div>
        ) : (
          proof.aiChecks.map((c) => <CheckRow key={c.id} check={c} />)
        )}
      </div>
      <div className="px-4 py-3 border-t border-gardens-bdr flex items-center gap-2">
        <Btn variant="secondary" size="sm" icon={<Icon name="send" size={11} />}>
          Send to customer
        </Btn>
        <Btn variant="ghost" size="sm">
          Re-render
        </Btn>
      </div>
    </Card>
  );
};

const CheckRow: React.FC<{ check: ProofCheck }> = ({ check }) => (
  <div
    className="p-2.5 rounded-md flex items-start gap-2"
    style={{
      background: check.level === 'pass' ? 'var(--g-grn-lt)' : check.level === 'warn' ? 'var(--g-amb-lt)' : check.level === 'fail' ? 'var(--g-red-lt)' : 'var(--g-page)',
      border: '1px solid var(--g-bdr)',
      opacity: check.dismissedAt ? 0.55 : 1,
    }}
  >
    <Pill tone={CHECK_TONE[check.level]} dot={check.level === 'fail'}>
      {check.level}
    </Pill>
    <div className="flex-1 min-w-0">
      <div className="text-[12px] font-semibold text-gardens-tx leading-snug">{check.label}</div>
      {check.suggest && (
        <div className="text-[11px] text-gardens-txs italic mt-0.5">→ {check.suggest}</div>
      )}
    </div>
  </div>
);

const RecentLog: React.FC<{ proofs: ProofItem[] }> = ({ proofs }) => (
  <Card padded>
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <h3 className="font-head text-[15px] font-semibold text-gardens-tx m-0">
          Recently approved
        </h3>
        <div className="text-[11.5px] text-gardens-txs">Cleared for workshop</div>
      </div>
      <Pill tone="green">{proofs.length}</Pill>
    </div>
    <div className="flex flex-col divide-y" style={{ borderColor: 'var(--g-bdr)' }}>
      {proofs.map((p) => (
        <div key={p.id} className="py-2 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold text-gardens-tx truncate">
              {p.customerName}
            </div>
            <div
              className="text-[10.5px] text-gardens-txm"
              style={{ fontFamily: 'ui-monospace, monospace' }}
            >
              OR-{p.orderNumber ?? '—'} · v{p.version}
            </div>
          </div>
          <span className="text-[10.5px] text-gardens-txs">Approved {compactDate(p.approvedAt)}</span>
        </div>
      ))}
    </div>
  </Card>
);
