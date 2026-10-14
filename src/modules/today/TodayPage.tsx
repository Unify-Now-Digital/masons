import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { cn } from '@/shared/lib/utils';
import { exitJob } from '@/modules/jobsPipeline/api/jobsPipeline.api';
import { useQueryClient } from '@tanstack/react-query';
import { useNow } from '@/modules/sections/useSectionsData';
import { useBrandData } from './useBrandData';
import { allTodayInputs } from './todayRules';
import { buildToday, headerText, LANE_CAPS, LANES, TIER_LABEL, updateSeen, type Lane, type TodayItem } from './todayModel';
import { Card, ErrorNote, gbp0, H3, shortDate, VerbPill } from './ui';

const seenKey = (org: string) => `mason-today-seen:${org}`;
const readSeen = (org: string | null): Record<string, string> => {
  if (!org) return {};
  try { return JSON.parse(localStorage.getItem(seenKey(org)) ?? '{}'); } catch { return {}; }
};

const Row: React.FC<{ i: TodayItem; onGo: (to: string) => void; rank: number }> = ({ i, onGo, rank }) => (
  <li className="py-2 px-1 sm:px-2" data-testid="today-row" data-verb={i.verb}>
    <div className="flex items-start gap-2 sm:gap-3">
      <span className="w-5 shrink-0 pt-1 text-right text-[11px] tabular-nums text-gardens-txm-aa">{rank}</span>
      <button type="button" onClick={() => onGo(i.to)} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-head text-[14px] font-semibold text-gardens-tx truncate max-w-full">{i.name}</span>
          {i.ref && <span className="text-[11px] text-gardens-txs">{i.ref}</span>}
          {i.valueGbp != null && <span className="text-[12px] font-semibold tabular-nums text-gardens-tx">{gbp0(i.valueGbp)}</span>}
          {i.carriedDays > 0 && <span className="rounded bg-gardens-sem-amber-lt px-1 text-[10.5px] font-semibold text-amber-800">carried {i.carriedDays}d</span>}
        </span>
        <span className="block text-[12px] text-gardens-txs">{i.why}{i.flagTo ? ` → ${i.flagTo}` : ''}</span>
        <span className="block text-[11px] text-gardens-txm-aa">
          {i.daysSinceOut == null ? 'We never wrote' : `${i.daysSinceOut}d since our last message`}
          {' · '}in {shortDate(i.lastInAt)} · out {shortDate(i.lastOutAt)}
        </span>
      </button>
      <VerbPill colour={i.colour} onClick={() => onGo(i.to)}>{i.verb}</VerbPill>
    </div>
  </li>
);

/** Today (Hub): one ranked list per lane for the active brand. */
export const TodayPage: React.FC = () => {
  const navigate = useNavigate();
  const nowDate = useNow();
  const now = nowDate.getTime();
  const canSeeMoney = useCanSeeMoney();
  const { organizationId, organizationName } = useOrganization();
  const q = useBrandData(canSeeMoney);
  const qc = useQueryClient();
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

  const confirmAbandoned = async (i: TodayItem) => {
    if (!organizationId || !i.key.startsWith('job:')) return;
    if (!window.confirm(`Mark ${i.name} as lost (abandoned)? It leaves the pipeline; you can reopen it later.`)) return;
    try {
      await exitJob({ organizationId, jobId: i.key.slice(4), reason: 'lost' });
      qc.invalidateQueries({ queryKey: ['brand-data'] });
    } catch (e) { window.alert(`Couldn't update: ${(e as Error).message}`); }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="today">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="m-0 font-head text-xl sm:text-2xl font-semibold text-gardens-tx">Today</h1>
        <span className="text-[13px] text-gardens-txs">{nowDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}{organizationName ? ` · ${organizationName}` : ''}</span>
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
                {rows.map((i, n) => (
                  <React.Fragment key={i.key}>
                    {(n === 0 || rows[n - 1].tier !== i.tier) && (
                      <li className="pt-2 px-1 text-[10.5px] font-bold uppercase tracking-wide text-gardens-txs">{TIER_LABEL[i.tier]}</li>
                    )}
                    <Row i={i} rank={n + 1} onGo={navigate} />
                  </React.Fragment>
                ))}
              </ol>
            )}
            {later.length > 0 && (
              <div className="mt-2 px-1">
                <button type="button" className="text-[12px] underline text-gardens-txs" onClick={() => setShowMore((v) => !v)}>
                  {showMore ? 'Hide' : `${later.length} more after today's cap`}
                </button>
                {showMore && (
                  <ol className="m-0 mt-1 list-none divide-y divide-gardens-bdr p-0 opacity-80">
                    {later.map((i, n) => <Row key={i.key} i={i} rank={rows.length + n + 1} onGo={navigate} />)}
                  </ol>
                )}
              </div>
            )}
          </Card>

          <div className="flex flex-col gap-3">
            <Card>
              <H3>Abandoned? · {plan.abandoned.length}</H3>
              <p className="m-0 mt-1 text-[12px] text-gardens-txs">Quiet 60–89 days. Never closed automatically: confirm each one.</p>
              <ul className="m-0 mt-1 list-none p-0 divide-y divide-gardens-bdr max-h-[320px] overflow-auto">
                {plan.abandoned.map((i) => (
                  <li key={i.key} className="flex items-center gap-2 py-1.5">
                    <button type="button" onClick={() => navigate(i.to)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13px] font-semibold text-gardens-tx">{i.name}</span>
                      <span className="block text-[11px] text-gardens-txm-aa">quiet {i.quietDays}d · {i.why}</span>
                    </button>
                    <button type="button" onClick={() => confirmAbandoned(i)} className="shrink-0 rounded border border-gardens-bdr px-2 py-0.5 text-[11px] text-gardens-txs hover:bg-gardens-page">Yes, lost</button>
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
                    <button type="button" onClick={() => navigate(i.to)} className="w-full text-left">
                      <span className="flex justify-between gap-2"><span className="truncate text-[13px] font-semibold text-gardens-tx">{i.name}</span><span className="text-[12px] tabular-nums">{gbp0(i.valueGbp)}</span></span>
                      <span className="block text-[11px] text-gardens-txm-aa">quiet {i.quietDays}d · {i.ref ?? 'enquiry'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
