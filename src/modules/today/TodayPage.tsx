import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { cn } from '@/shared/lib/utils';
import { useNow } from '@/modules/sections/useSectionsData';
import { useBrandData } from './useBrandData';
import { allTodayInputs } from './todayRules';
import { buildToday, headerText, LANE_CAPS, LANES, TIER_LABEL, updateSeen, type Lane, type TodayItem } from './todayModel';
import { Card, ErrorNote, gbp0, H3, VerbPill } from './ui';
import { useOpenOrder } from '@/shared/context/OrderPanelContext';

const seenKey = (org: string) => `mason-today-seen:${org}`;
const readSeen = (org: string | null): Record<string, string> => {
  if (!org) return {};
  try { return JSON.parse(localStorage.getItem(seenKey(org)) ?? '{}'); } catch { return {}; }
};

const CHANNEL: Record<string, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', phone: 'Call' };
const ageText = (i: TodayItem, now: number) => {
  const from = i.lastInAt ?? i.sinceAt; if (!from) return null;
  const h = Math.max(0, Math.floor((now - Date.parse(from)) / 3_600_000));
  return h < 48 ? `${h}h` : `${Math.floor(h / 24)}d`;
};
/** Hub v2 row: who · what they asked · last words · how long · the ONE prepared action + why it is ranked here. */
const Row: React.FC<{ i: TodayItem; onGo: (i: TodayItem) => void; rank: number; now: number; compact?: boolean }> = ({ i, onGo, rank, now, compact }) => {
  const age = ageText(i, now);
  const ctx = [i.channel ? CHANNEL[i.channel] ?? i.channel : null, i.subject && i.subject !== 'No subject' ? i.subject : null].filter(Boolean).join(' · ');
  return (
    <li className="py-2 px-1 sm:px-2" data-testid="today-row" data-verb={i.verb}>
      <div className="flex items-start gap-2 sm:gap-3">
        <span className="w-5 shrink-0 pt-1 text-right text-[11px] tabular-nums text-gardens-txm-aa">{rank}</span>
        <button type="button" onClick={() => onGo(i)} className="min-w-0 flex-1 text-left">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-head text-[14px] font-semibold text-gardens-tx truncate max-w-full">{i.name}</span>
            {i.ref && <span className="text-[11px] text-gardens-txs">{i.ref}</span>}
            {i.valueGbp != null && <span className="text-[12px] font-semibold tabular-nums text-gardens-tx">{gbp0(i.valueGbp)}</span>}
            {ctx && <span className="text-[11px] text-gardens-txs truncate max-w-[22rem]">{ctx}</span>}
          </span>
          {i.snippet && <span className="block truncate text-[12.5px] text-gardens-tx/80">“{i.snippet}”</span>}
          {!compact && (
            <span className="block text-[11px] text-gardens-txm-aa">
              <b className="font-semibold text-gardens-txs">Why here:</b> {i.why}{i.flagTo ? ` → ${i.flagTo}` : ''}
              {i.carriedDays > 0 ? ` · on the list ${i.carriedDays}d` : ''}
            </span>
          )}
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <VerbPill colour={i.colour} onClick={() => onGo(i)}>{VERB_LABEL[i.verb] ?? i.verb}</VerbPill>
          {age && <span className={cn('text-[11px] tabular-nums', i.colour === 'red' ? 'text-gardens-na-red font-semibold' : 'text-gardens-txm-aa')}>waiting {age}</span>}
        </div>
      </div>
    </li>
  );
};

/** One vocabulary with the rest of the app (brandbook): sentence-case verbs, no abbreviations. */
const VERB_LABEL: Record<string, string> = { REPLY: 'Reply', CALL: 'Call', CHASE: 'Chase', QUOTE: 'Send quote', INVOICE: 'Create invoice', 'SOFT FUP': 'Follow up', CONFIRM: 'Confirm', FLAG: 'Escalate', WAIT: 'Waiting' };

/** Consecutive rows with the same reason (e.g. 12× "Waiting for our first reply") collapse into one block. */
function chunk(rows: TodayItem[]): { why: string; tier: number; items: TodayItem[] }[] {
  const out: { why: string; tier: number; items: TodayItem[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.why === r.why && last.tier === r.tier) last.items.push(r);
    else out.push({ why: r.why, tier: r.tier, items: [r] });
  }
  return out;
}

/** Today (Hub): one ranked list per lane for the active brand. */
export const TodayPage: React.FC = () => {
  const navigate = useNavigate();
  const openOrder = useOpenOrder();
  const go = (i: { to: string }) => { const m = /\/dashboard\/orders\?order=([^&]+)/.exec(i.to); if (m) openOrder(decodeURIComponent(m[1])); else navigate(i.to); };
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const nowDate = useNow();
  const now = nowDate.getTime();
  const canSeeMoney = useCanSeeMoney();
  const { organizationId, organizationName } = useOrganization();
  const q = useBrandData(canSeeMoney);
  const [lane, setLane] = useState<Lane>('Sales');
  const [showMore, setShowMore] = useState(false);
  const [seen, setSeen] = useState<Record<string, string>>(() => readSeen(organizationId));
  useEffect(() => setSeen(readSeen(organizationId)), [organizationId]);

  const plan = useMemo(() => (q.data ? buildToday(allTodayInputs(q.data.data, now, canSeeMoney), now, seen) : null), [q.data, now, canSeeMoney, seen]);
  useEffect(() => {
    if (!plan || !organizationId) return;
    const next = updateSeen(seen, plan, now);
    if (JSON.stringify(next) !== JSON.stringify(seen)) localStorage.setItem(seenKey(organizationId), JSON.stringify(next));
  }, [plan, organizationId, seen, now]);

  const lanes = LANES.filter((l) => l !== 'Finance' || canSeeMoney);
  const rows = plan?.today[lane] ?? [];
  const later = plan?.later[lane] ?? [];

  return (
    <div className="flex flex-col gap-3" data-testid="today">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="sr-only">Hub · Today</h1>
        <span className="text-[13px] font-semibold text-gardens-tx">{nowDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}{organizationName ? ` · ${organizationName}` : ''}</span>
        {plan && <span className="text-[13px] font-semibold text-gardens-tx" data-testid="today-header">{headerText(plan)}</span>}
      </div>

      {q.isError && <ErrorNote title="Couldn't load Today." message={(q.error as Error).message} />}
      {q.data?.moneyError && <ErrorNote title="Money data didn't load, so Finance rows are missing:" message={q.data.moneyError} />}
      {q.isLoading && <Card><p className="m-0 text-[13px] text-gardens-txs">Loading today's list…</p></Card>}

      {plan && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <Card className="p-2 sm:p-3">
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-gardens-page p-1" role="tablist" aria-label="Lane">
              {lanes.map((l) => (
                <button key={l} type="button" role="tab" aria-selected={lane === l} onClick={() => { setLane(l); setShowMore(false); }}
                  className={cn('rounded-md px-1 py-1.5 text-[12px] sm:text-[13px]', lane === l ? 'bg-gardens-surf font-bold text-gardens-tx shadow-sm' : 'text-gardens-txs')}>
                  {l} <b className="tabular-nums">{plan.today[l].length}</b>
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-1 px-1 text-[11px] text-gardens-txm-aa">
              <span>{rows.length} to do · {rows.filter((r) => r.carriedDays > 0).length} carried over</span>
              <span>Daily cap {LANE_CAPS[lane]}</span>
            </div>
            {rows.length === 0 ? (
              <p className="m-0 mt-3 px-1 text-[13px] text-gardens-txs">Nothing to do in {lane} today.</p>
            ) : (
              <ol className="m-0 mt-1 list-none divide-y divide-gardens-bdr p-0">
                {(() => { let n = 0; return chunk(rows).map((g, gi, all) => {
                  const head = (gi === 0 || all[gi - 1].tier !== g.tier) && (
                    <li key={`t${gi}`} className="pt-2 px-1 text-[10.5px] font-bold uppercase tracking-wide text-gardens-txs">{TIER_LABEL[g.tier as keyof typeof TIER_LABEL]}</li>
                  );
                  if (g.items.length < 3) return <React.Fragment key={gi}>{head}{g.items.map((i) => <Row key={i.key} i={i} rank={++n} onGo={go} now={now} />)}</React.Fragment>;
                  const start = n + 1; n += g.items.length;
                  return (
                    <React.Fragment key={gi}>
                      {head}
                      <li className="py-2 px-1 sm:px-2" data-testid="today-group">
                        <div className="flex items-baseline justify-between gap-2 rounded-md bg-gardens-page px-2 py-1.5">
                          <span className="text-[12.5px] text-gardens-tx"><b>{g.items.length} × {g.why}</b> <span className="text-gardens-txs">· oldest first · #{start}–{n}</span></span>
                          <VerbPill colour={g.items[0].colour} onClick={() => go(g.items[0])}>Start with oldest</VerbPill>
                        </div>
                        <ol className="m-0 list-none divide-y divide-gardens-bdr p-0">
                          {g.items.map((i, k) => <Row key={i.key} i={i} rank={start + k} onGo={go} now={now} compact />)}
                        </ol>
                      </li>
                    </React.Fragment>
                  );
                }); })()}
              </ol>
            )}
            {later.length > 0 && (
              <div className="mt-2 px-1">
                <button type="button" className="text-[12px] underline text-gardens-txs" onClick={() => setShowMore((v) => !v)}>
                  {showMore ? 'Hide' : `${later.length} more after today's cap`}
                </button>
                {showMore && (
                  <ol className="m-0 mt-1 list-none divide-y divide-gardens-bdr p-0 opacity-80">
                    {later.map((i, n) => <Row key={i.key} i={i} rank={rows.length + n + 1} onGo={go} now={now} />)}
                  </ol>
                )}
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-3">
            <Card>
              <button type="button" className="flex w-full items-center justify-between text-left" aria-expanded={cleanupOpen} onClick={() => setCleanupOpen((v) => !v)} data-testid="hub-cleanup-toggle">
                <H3>Pipeline clean-up · {plan.abandoned.length + plan.closeOrRequote.length}</H3>
                <span className="text-[12px] text-gardens-txs">{cleanupOpen ? 'Hide' : 'Show'}</span>
              </button>
              <p className="m-0 mt-1 text-[12px] text-gardens-txs">{plan.abandoned.length} quiet 60–89 days · {plan.closeOrRequote.length} quiet 90+ days ({gbp0(plan.closeOrRequote.reduce((s, i) => s + (i.valueGbp ?? 0), 0))}). Not today's work: weekly review. Proposed home: Pipeline › Clean-up.</p>
            </Card>
            {cleanupOpen && <>
            <Card>
              <H3>Abandoned? · {plan.abandoned.length}</H3>
              <p className="m-0 mt-1 text-[12px] text-gardens-txs">Quiet 60–89 days. Never closed automatically. Closing as abandoned turns on once the 'abandoned' status exists (pending approval).</p>
              <ul className="m-0 mt-1 list-none p-0 divide-y divide-gardens-bdr max-h-[320px] overflow-auto">
                {plan.abandoned.map((i) => (
                  <li key={i.key} className="flex items-center gap-2 py-1.5">
                    <button type="button" onClick={() => go(i)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13px] font-semibold text-gardens-tx">{i.name}</span>
                      <span className="block text-[11px] text-gardens-txm-aa">quiet {i.quietDays}d · {i.why}</span>
                    </button>
                    <button type="button" disabled title="Needs the 'abandoned' close status (migration 20261014203000, awaiting approval). Never closes as lost." className="shrink-0 cursor-not-allowed rounded border border-dashed border-gardens-bdr px-2 py-0.5 text-[11px] text-gardens-txm-aa">Yes, abandoned</button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <H3>Close or re-quote · {plan.closeOrRequote.length}</H3>
              <p className="m-0 mt-1 text-[12px] text-gardens-txs">Quiet 90+ days. Highest value first.</p>
              <ul className="m-0 mt-1 list-none p-0 divide-y divide-gardens-bdr max-h-[320px] overflow-auto">
                {plan.closeOrRequote.map((i) => (
                  <li key={i.key} className="py-1.5">
                    <button type="button" onClick={() => go(i)} className="w-full text-left">
                      <span className="flex justify-between gap-2"><span className="truncate text-[13px] font-semibold text-gardens-tx">{i.name}</span><span className="text-[12px] tabular-nums">{gbp0(i.valueGbp)}</span></span>
                      <span className="block text-[11px] text-gardens-txm-aa">quiet {i.quietDays}d · {i.ref ?? 'enquiry'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            </>}
          </div>
        </div>
      )}
    </div>
  );
};
