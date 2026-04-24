import React, { useEffect, useMemo, useState } from 'react';
import { Card, Pill, Btn, Icon, AIBadge, AISuggestion, Avatar } from '@/shared/components/gardens';
import { useEnquiries } from '../hooks/useEnquiryTriage';
import type { EnquiryChannel, EnquiryItem } from '../api/enquiryTriage.api';

const compactDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const CHANNEL_ICON: Record<EnquiryChannel, string> = {
  email: 'mail',
  whatsapp: 'chat',
  sms: 'phone',
};

const CHANNEL_COLOR: Record<EnquiryChannel, string> = {
  email: 'var(--g-txs)',
  whatsapp: '#25D366',
  sms: 'var(--g-blu)',
};

/** Pre-order conversation stages. Derived from extraction + orderId + unreadCount. */
type InboxStage = 'new' | 'review' | 'ready' | 'drafted';

const STAGE_LABEL: Record<InboxStage, string> = {
  new: 'New',
  review: 'Needs review',
  ready: 'Ready to draft',
  drafted: 'Drafted',
};

const STAGE_DESCRIPTION: Record<InboxStage, string> = {
  new: 'Just arrived, not yet analysed by AI.',
  review: 'AI extracted low-to-mid confidence — human eyes needed.',
  ready: 'High confidence extraction, safe to auto-draft into an order.',
  drafted: 'Already converted to a draft order; awaiting approval in Orders.',
};

const STAGE_ORDER: InboxStage[] = ['new', 'review', 'ready', 'drafted'];

function deriveStage(e: EnquiryItem): InboxStage {
  if (e.orderId) return 'drafted';
  if (!e.extraction) return 'new';
  const c = e.extraction.confidence ?? 0;
  if (c >= 85) return 'ready';
  return 'review';
}

/**
 * Score an enquiry for prioritisation within its stage.
 * Higher = more attention-worthy. Drafted items are always scored low.
 */
function scoreEnquiry(e: EnquiryItem): number {
  if (e.orderId) return 0;
  const ageHours = e.receivedAt
    ? Math.max(0, (Date.now() - new Date(e.receivedAt).getTime()) / (1000 * 60 * 60))
    : 0;
  const ageScore = Math.min(40, ageHours); // up to 40 points for 40h+ age
  const unreadScore = Math.min(20, e.unreadCount * 5); // up to 20 for 4+ unread
  const confScore = e.extraction?.confidence != null
    ? Math.max(0, Math.min(20, e.extraction.confidence / 5)) // up to 20 at 100% conf
    : 10; // unanalysed ambiguity deserves mid attention
  const flagScore = Math.min(20, (e.extraction?.flags?.length ?? 0) * 5);
  return Math.round(ageScore + unreadScore + confScore + flagScore);
}

export const EnquiryTriagePage: React.FC = () => {
  const enquiries = useEnquiries();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState<InboxStage | null>(null);

  const items = useMemo(() => enquiries.data?.items ?? [], [enquiries.data]);

  const scored = useMemo(
    () => items.map((e) => ({ ...e, _stage: deriveStage(e), _score: scoreEnquiry(e) })),
    [items]
  );

  const byStage = useMemo(() => {
    const acc: Record<InboxStage, typeof scored> = { new: [], review: [], ready: [], drafted: [] };
    for (const e of scored) acc[e._stage].push(e);
    return acc;
  }, [scored]);

  const filtered = useMemo(() => {
    const base = stage ? byStage[stage] : scored;
    return [...base].sort((a, b) => b._score - a._score);
  }, [scored, byStage, stage]);

  const selected = filtered.find((i) => i.conversationId === selectedId) ?? filtered[0];

  useEffect(() => {
    if (filtered.length && !selected) setSelectedId(filtered[0].conversationId);
  }, [filtered, selected]);

  return (
    <div className="flex flex-col gap-3">
      <InboxPipelineStrip byStage={byStage} activeStage={stage} onStageChange={setStage} />
      <div className="grid gap-3 grid-cols-1 lg:grid-cols-[minmax(320px,380px)_1fr] lg:min-h-[600px]">
        <Queue
          loading={enquiries.isLoading}
          items={filtered}
          selectedId={selected?.conversationId ?? null}
          onSelect={setSelectedId}
          highConfidenceCount={enquiries.data?.highConfidenceCount ?? 0}
          activeStage={stage}
          onClearStage={() => setStage(null)}
        />
        <Detail enquiry={selected} />
      </div>
    </div>
  );
};

type ScoredEnquiry = EnquiryItem & { _stage: InboxStage; _score: number };

interface StripProps {
  byStage: Record<InboxStage, ScoredEnquiry[]>;
  activeStage: InboxStage | null;
  onStageChange: (stage: InboxStage | null) => void;
}

const STAGE_ICON: Record<InboxStage, string> = {
  new: 'mail',
  review: 'alert',
  ready: 'sparkle',
  drafted: 'check',
};

const InboxPipelineStrip: React.FC<StripProps> = ({ byStage, activeStage, onStageChange }) => (
  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
    {STAGE_ORDER.map((s) => {
      const list = byStage[s];
      const active = activeStage === s;
      const topScore = list[0]?._score ?? 0;
      return (
        <button
          key={s}
          type="button"
          onClick={() => onStageChange(active ? null : s)}
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
              <Icon name={STAGE_ICON[s]} size={11} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gardens-txm">
              {STAGE_LABEL[s]}
            </span>
          </div>
          <div className="font-head text-[24px] font-semibold text-gardens-tx leading-none">
            {list.length}
          </div>
          <div className="mt-2 text-[11px] text-gardens-txs truncate">
            {list.length === 0
              ? STAGE_DESCRIPTION[s]
              : s === 'drafted'
                ? 'Awaiting approval in Orders'
                : `Top priority score ${topScore}`}
          </div>
        </button>
      );
    })}
  </div>
);

interface QueueProps {
  loading: boolean;
  items: ScoredEnquiry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  highConfidenceCount: number;
  activeStage: InboxStage | null;
  onClearStage: () => void;
}

const Queue: React.FC<QueueProps> = ({
  loading,
  items,
  selectedId,
  onSelect,
  highConfidenceCount,
  activeStage,
  onClearStage,
}) => (
  <Card
    padded={false}
    className="flex flex-col overflow-hidden max-h-[60vh] lg:max-h-none"
    style={{ minHeight: 0 }}
  >
    <div className="px-3 py-2.5 border-b border-gardens-bdr flex items-center gap-2 flex-wrap">
      <div className="text-[12px] font-semibold text-gardens-tx">
        {activeStage ? STAGE_LABEL[activeStage] : 'All enquiries'}
      </div>
      <Pill tone="accent" dot>
        {items.length} active
      </Pill>
      <div className="flex-1" />
      {activeStage ? (
        <Btn variant="ghost" size="sm" icon={<Icon name="x" size={11} />} onClick={onClearStage}>
          Clear stage
        </Btn>
      ) : (
        <span className="text-[11px] text-gardens-txm italic">Sorted by score</span>
      )}
    </div>
    {highConfidenceCount > 0 && (
      <div className="p-2.5 border-b border-gardens-bdr">
        <AISuggestion
          compact
          title={`${highConfidenceCount} look safe to auto-draft`}
          confidence={92}
          actions={
            <>
              <Btn variant="ai" size="sm" icon={<Icon name="check" size={11} stroke={2} />}>
                Approve {highConfidenceCount} drafts
              </Btn>
              <Btn variant="ghost" size="sm">
                Review one by one
              </Btn>
            </>
          }
        />
      </div>
    )}
    <div className="flex-1 overflow-y-auto">
      {loading ? (
        <div className="p-3 text-[12px] text-gardens-txs">Loading enquiries…</div>
      ) : items.length === 0 ? (
        <div className="p-3 text-[12px] text-gardens-txs">
          Nothing in the inbox right now. New enquiries will appear here.
        </div>
      ) : (
        items.map((e) => (
          <QueueRow
            key={e.conversationId}
            enquiry={e}
            active={e.conversationId === selectedId}
            onClick={() => onSelect(e.conversationId)}
          />
        ))
      )}
    </div>
  </Card>
);

const QueueRow: React.FC<{ enquiry: ScoredEnquiry; active: boolean; onClick: () => void }> = ({
  enquiry,
  active,
  onClick,
}) => {
  const conf = enquiry.extraction?.confidence ?? null;
  const confTone =
    conf == null ? 'neutral' : conf > 90 ? 'green' : conf > 80 ? 'amber' : 'neutral';
  const drafted = !!enquiry.orderId;
  const scoreTone: 'red' | 'amber' | 'neutral' =
    enquiry._score >= 80 ? 'red' : enquiry._score >= 50 ? 'amber' : 'neutral';
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '12px 14px',
        textAlign: 'left',
        background: active ? 'var(--g-acc-lt)' : 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--g-bdr)',
        cursor: 'pointer',
        opacity: drafted ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: CHANNEL_COLOR[enquiry.channel], display: 'inline-flex' }}>
          <Icon name={CHANNEL_ICON[enquiry.channel]} size={12} />
        </span>
        <span className="text-[12.5px] font-semibold text-gardens-tx flex-1 truncate">
          {enquiry.fromHandle}
        </span>
        <span
          className="text-[10.5px] text-gardens-txm"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        >
          {compactDate(enquiry.receivedAt)}
        </span>
      </div>
      <div
        className="text-[11.5px] text-gardens-txs leading-snug"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {enquiry.subject && (
          <span className="font-semibold text-gardens-tx">{enquiry.subject} — </span>
        )}
        {enquiry.preview ?? 'No preview'}
      </div>
      <div className="mt-1.5 flex items-center gap-1 flex-wrap">
        {drafted ? (
          <Pill tone="green" dot>Order drafted</Pill>
        ) : conf != null ? (
          <Pill tone={confTone}>
            <Icon name="sparkle" size={9} /> {conf}% confident
          </Pill>
        ) : (
          <Pill tone="neutral">Not yet analysed</Pill>
        )}
        {enquiry.unreadCount > 0 && <Pill tone="accent">{enquiry.unreadCount} unread</Pill>}
        {!drafted && (
          <Pill tone={scoreTone as never}>
            Score {enquiry._score}
          </Pill>
        )}
      </div>
    </button>
  );
};

const Detail: React.FC<{ enquiry?: EnquiryItem }> = ({ enquiry }) => {
  if (!enquiry) {
    return (
      <Card padded>
        <div className="text-[12px] text-gardens-txs">Select an enquiry from the queue.</div>
      </Card>
    );
  }
  const ext = enquiry.extraction;
  return (
    <Card padded={false} className="flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gardens-bdr flex items-start gap-3">
        <Avatar name={enquiry.fromHandle} size={36} tone="accent" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="font-head text-[16px] font-semibold text-gardens-tx truncate">
              {enquiry.fromHandle}
            </div>
            <Pill tone="neutral" style={{ fontFamily: 'ui-monospace, monospace' }}>
              {enquiry.conversationId.slice(0, 8)}
            </Pill>
          </div>
          <div
            className="text-[11px] text-gardens-txs"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            {enquiry.primaryHandle} · via {enquiry.channel}
          </div>
        </div>
        <Btn variant="ghost" size="sm" icon={<Icon name="phone" size={11} />}>
          Call
        </Btn>
        <Btn variant="secondary" size="sm" icon={<Icon name="chat" size={11} />}>
          Reply
        </Btn>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 min-h-full" style={{ minHeight: 0 }}>
          <div className="p-5 border-r border-gardens-bdr">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-gardens-txm mb-2">
              Original message
            </div>
            {enquiry.subject && (
              <div className="font-head text-[15px] font-semibold text-gardens-tx mb-3">
                {enquiry.subject}
              </div>
            )}
            <div
              className="text-[13px] text-gardens-tx leading-relaxed"
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {enquiry.preview ?? 'No preview available.'}
            </div>
            {ext?.flags && ext.flags.length > 0 && (
              <div className="mt-4 flex gap-1.5 flex-wrap">
                {ext.flags.map((f, i) => (
                  <Pill key={i} tone="amber" dot>
                    {f}
                  </Pill>
                ))}
              </div>
            )}
          </div>

          <div className="p-5" style={{ background: 'var(--g-surf2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-gardens-txm">
                AI-drafted order
              </div>
              <AIBadge
                label="DRAFT"
                size="sm"
                variant="ghost"
                confidence={ext?.confidence ?? undefined}
              />
            </div>

            {ext == null ? (
              <div className="p-3 rounded-md bg-gardens-page text-[12px] text-gardens-txs">
                Mason hasn't analysed this enquiry yet. The AI extraction worker writes its
                results to <code>inbox_enquiry_extraction</code> as new conversations arrive.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <DraftField label="Customer" value={ext.customerName} confidence={ext.confidence} />
                <DraftField
                  label="Phone"
                  value={ext.customerPhone}
                  confidence={ext.confidence}
                  missing={!ext.customerPhone && enquiry.channel === 'email'}
                />
                <DraftField label="Order type" value={ext.orderType} confidence={ext.confidence} />
                <DraftField label="Product" value={ext.productText} confidence={ext.confidence} />
                <DraftField label="Cemetery" value={ext.cemeteryText} confidence={ext.confidence} />
                <DraftField
                  label="Inscription"
                  value={ext.inscriptionText}
                  confidence={ext.confidence}
                  multiline
                  missing={!ext.inscriptionText}
                />
              </div>
            )}

            <div className="mt-4 flex gap-2 flex-wrap">
              <Btn
                variant="primary"
                icon={<Icon name="check" size={11} stroke={2.2} />}
                disabled={!!enquiry.orderId}
              >
                {enquiry.orderId ? 'Order drafted' : 'Create order from this'}
              </Btn>
              <Btn variant="secondary" icon={<Icon name="undo" size={11} />}>
                Edit draft
              </Btn>
              <Btn variant="ghost">Dismiss</Btn>
            </div>

            <div
              className="mt-4 p-3 rounded-md text-[11.5px] text-gardens-txs leading-relaxed"
              style={{ background: 'var(--g-page)' }}
            >
              <strong className="text-gardens-tx">Next step after approval:</strong> Mason drafts
              a holding reply you can edit, then routes to the Orders list as "Enquiry — needs
              quote".
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

const DraftField: React.FC<{
  label: string;
  value?: string | null;
  confidence?: number | null;
  missing?: boolean;
  multiline?: boolean;
}> = ({ label, value, confidence, missing, multiline }) => (
  <div
    className="p-2.5 rounded-md"
    style={{
      background: missing ? 'var(--g-amb-lt)' : 'var(--g-page)',
      border: `1px solid ${missing ? 'rgba(194,105,59,0.3)' : 'var(--g-bdr)'}`,
    }}
  >
    <div className="flex items-center gap-1.5 mb-0.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-gardens-txm">
        {label}
      </span>
      {confidence != null && !missing && (
        <span
          className="text-[9.5px] text-gardens-txm"
          style={{ fontFamily: 'ui-monospace, monospace' }}
        >
          · {confidence}%
        </span>
      )}
      {missing && (
        <span className="text-[10px] text-gardens-amb-dk font-semibold">· missing</span>
      )}
    </div>
    <div
      className="text-[13px]"
      style={{
        color: value ? 'var(--g-tx)' : 'var(--g-txm)',
        fontStyle: value ? 'normal' : 'italic',
        whiteSpace: multiline ? 'normal' : 'nowrap',
        overflow: multiline ? 'visible' : 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {value || 'Not mentioned — Mason will ask the customer'}
    </div>
  </div>
);
