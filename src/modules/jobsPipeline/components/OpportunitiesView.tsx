import { useState, type ReactNode } from 'react';
import { useCanSeeMoney } from '@/app/components/useCanSeeMoney';
import { useOpenPerson } from '@/shared/context/personPanel';
import { ChevronRight, Mail } from 'lucide-react';
import { ActionPill, WaitingChip } from '@/shared/components/mason';
import { formatGbpDecimal } from '@/shared/lib/formatters';
import { cn } from '@/shared/lib/utils';
import { ACTION_COLOUR_CLASS } from '@/shared/nextAction';
import { getJobDisplayName } from '../utils/display';
import { LeadSourcePill } from '@/shared/components/mason';
import { resolveAttribution } from '@/shared/lib/leadSource';
import { byValue, TODAY_CAP, type Forecast, type Opportunity } from '../utils/opportunities';

const gbp = (n: number) => (n >= 10_000 ? `£${(n / 1000).toFixed(1)}k` : formatGbpDecimal(n).replace(/\.00$/, ''));
const shortAgo = (iso: string | null) => {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d < 1 ? 'today' : `${d}d`;
};

function ActionFor({ o, solid }: { o: Opportunity; solid?: boolean }) {
  const a = o.action;
  if (a.kind === 'waiting') return <WaitingChip label={a.label} />;
  return <ActionPill kind={a.kind} label={a.label} tone={a.colour === 'red' ? 'red' : 'amber'} solid={solid} />;
}

function Value({ o }: { o: Opportunity }) {
  const canSeeMoney = useCanSeeMoney();
  if (!canSeeMoney) return null;
  if (o.valueSource === 'order' || o.valueSource === 'invoice') {
    const title = o.valueSource === 'order' ? 'Order total, including the permit' : 'Invoice total';
    return <span className="tabular-nums font-semibold text-gardens-tx" title={title}>{gbp(o.value)}</span>;
  }
  if (o.valueSource === 'gmail_quote')
    return <span className="tabular-nums font-semibold text-gardens-tx" title={`Latest quote in Gmail, sent ${o.quoteAt?.slice(0, 10)}`}>{gbp(o.value)}</span>;
  const guide = o.valueSource === 'guide';
  return (
    <span className="inline-flex items-center gap-1 tabular-nums text-gardens-txs whitespace-nowrap" title={guide ? 'Guide price from the form, not a quote' : 'No price anywhere: typical SM value used'}>
      ~{gbp(o.value)}
      <span className={cn('rounded px-1 text-[10px] font-bold whitespace-nowrap', ACTION_COLOUR_CLASS.amber.tint)}>{guide ? 'guide' : 'price?'}</span>
    </span>
  );
}


function Row({ o, n }: { o: Opportunity; n?: number }) {
  const openPerson = useOpenPerson();
  return (
    <li data-testid="opp-row" data-colour={o.action.colour} className="border-b border-gardens-bdr last:border-b-0">
      <button type="button" onClick={() => openPerson({ personId: o.job.person_id, conversationId: o.job.conversation_id, name: getJobDisplayName(o.job) })} className="w-full text-left grid grid-cols-[1fr_auto] md:grid-cols-[1.5rem_minmax(9rem,1.2fr)_5rem_8rem_5rem_minmax(10rem,2fr)_10.5rem] items-center gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-gardens-page">
        <span className="hidden md:block text-[12px] text-gardens-txm-aa tabular-nums">{n}</span>
        <span className="min-w-0 flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full shrink-0 md:hidden', ACTION_COLOUR_CLASS[o.action.colour].solid)} aria-hidden />
          <span className="font-head text-[14px] font-semibold text-gardens-tx truncate">{getJobDisplayName(o.job)}</span>
          <span className="hidden lg:inline-flex shrink-0"><LeadSourcePill {...resolveAttribution(o.job, o.job.enquiry)} /></span>
        </span>
        <span className="md:hidden justify-self-end"><Value o={o} /></span>
        <span className="hidden md:block text-[12px] text-gardens-txs">{o.displayStage}</span>
        <span className="hidden md:block"><Value o={o} /></span>
        <span className="hidden md:block text-[12px] text-gardens-txs tabular-nums" title="Last in / last out">{shortAgo(o.lastIn)} / {shortAgo(o.lastOut)}</span>
        <span className="text-[12px] text-gardens-txs truncate col-span-1">{o.action.why}</span>
        <span className="justify-self-end"><ActionFor o={o} /></span>
      </button>
    </li>
  );
}

function Section({ title, count, children, testId, hint }: { title: string; count: number; children: ReactNode; testId: string; hint?: string }) {
  return (
    <details data-testid={testId} className="group rounded-[10px] border border-gardens-bdr bg-gardens-surf">
      <summary className="flex items-center gap-2 px-3 py-2.5 cursor-pointer list-none text-[13px] font-semibold text-gardens-tx">
        <ChevronRight className="h-4 w-4 text-gardens-txs transition-transform group-open:rotate-90" aria-hidden />
        {title} <span className="text-gardens-txs font-normal">{count}</span>
        {hint && <span className="ml-auto text-[11px] font-normal text-gardens-txm-aa hidden sm:inline">{hint}</span>}
      </summary>
      <div className="border-t border-gardens-bdr">{children}</div>
    </details>
  );
}

export function ForecastStrip({ f }: { f: Forecast }) {
  const [open, setOpen] = useState(false);
  const month = new Date().toLocaleString('en-GB', { month: 'long' });
  const cell = (label: string, value: string, sub?: string, id?: string) => (
    <div data-testid={id} className="min-w-0 px-3 py-2 sm:border-l first:border-l-0 border-gardens-bdr">
      <div className="text-[11px] uppercase tracking-[0.06em] text-gardens-txs font-bold">{label}</div>
      <div className="font-head text-[17px] font-semibold text-gardens-tx tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-gardens-txm-aa">{sub}</div>}
    </div>
  );
  return (
    <section
      data-testid="forecast-strip"
      aria-label="Forecast (admin only)"
      title={`Only you see this. Odds come from SM history (win chance falls with age: 13% new → 4% at 60d → 0% after 90d; Quoted stage ≈ doubles it; invoiced 60%). Abandoned-bucket deals excluded. Open total ${gbp(f.rawOpen)}.`}
      className="rounded-[10px] border border-gardens-bdr bg-gardens-surf"
    >
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="sm:hidden w-full flex items-center gap-2 px-3 py-2.5 text-left text-[13px] text-gardens-tx">
        <span><b>{month.slice(0, 3)}:</b> {gbp(f.closedMtd)} closed · expected <b className="tabular-nums">{gbp(f.expectedMonthLow)}–{gbp(f.expectedMonthHigh)}</b></span>
        <ChevronRight className={cn('ml-auto h-4 w-4 text-gardens-txs transition-transform', open && 'rotate-90')} aria-hidden />
      </button>
      <div className={cn(open ? 'grid border-t border-gardens-bdr sm:border-t-0' : 'hidden sm:grid', 'grid-cols-2 sm:grid-cols-5')}>
        {cell(`${month} closed`, gbp(f.closedMtd), `${f.closedMtdCount} deposits`, 'fc-closed')}
        {cell('Commit', gbp(f.commit), 'invoiced, active ≤30d')}
        {cell('Best case', gbp(f.bestCase), 'commit + engaged quotes')}
        {cell(`Expected ${month}`, `${gbp(f.expectedMonthLow)}–${gbp(f.expectedMonthHigh)}`, `≈ ${gbp(f.expectedMonth)}`, 'fc-expected')}
        {cell('Weighted pipeline', gbp(f.weighted), `≈ ${f.expectedWins} wins`, 'fc-weighted')}
      </div>
    </section>
  );
}

export function OpportunitiesView({ opps, today, forecast, board, listLoading = false }: { opps: Opportunity[]; today: Opportunity[]; forecast: Forecast | null; board: ReactNode; listLoading?: boolean }) {
  const canSeeMoney = useCanSeeMoney();
  const todayIds = new Set(today.map((o) => o.job.id));
  const rest = opps.filter((o) => o.bucket === 'today' && !todayIds.has(o.job.id)).sort((a, b) => b.score - a.score);
  const revive = opps.filter((o) => o.bucket === 'revive').sort(byValue);
  const abandoned = opps.filter((o) => o.bucket === 'abandoned').sort(byValue);
  const waiting = opps.filter((o) => o.bucket !== 'abandoned' && o.waitingOnUs).length;
  const never = opps.filter((o) => o.bucket !== 'abandoned' && o.neverContacted).length;
  const fromGmail = opps.filter((o) => o.valueSource === 'gmail_quote').length;
  return (
    <div className="space-y-3">
      {forecast && <ForecastStrip f={forecast} />}
      <section data-testid="opps-today" className="rounded-[10px] border border-gardens-bdr bg-gardens-surf overflow-hidden">
        <header className="px-3 py-2.5 border-b border-gardens-bdr flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="m-0 font-head text-[18px] font-semibold text-gardens-tx" title={`Ranked by chance × value × recency, top ${TODAY_CAP}`}>{today.length} best opportunities today</h2>
          <span className="text-[12px] text-gardens-txs">
            <b className={ACTION_COLOUR_CLASS.red.text}>{waiting} waiting on us</b> · {never} never contacted
          </span>
        </header>
        <div className="hidden md:grid grid-cols-[1.5rem_minmax(9rem,1.2fr)_5rem_8rem_5rem_minmax(10rem,2fr)_10.5rem] gap-x-3 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-gardens-txm-aa bg-gardens-page">
          <span>#</span><span>Family</span><span>Stage</span><span>Value</span><span>In / out</span><span>Why</span><span className="text-right">Next</span>
        </div>
        <ol className="m-0 p-0 list-none">
          {today.map((o, i) => <Row key={o.job.id} o={o} n={i + 1} />)}
          {today.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-gardens-txs">{listLoading ? 'Loading opportunities…' : 'Nothing needs you right now.'}</li>}
        </ol>
        {canSeeMoney && (
        <footer className="px-3 py-1.5 border-t border-gardens-bdr text-[11px] text-gardens-txm-aa flex items-center gap-1">
          <Mail className="h-3 w-3" aria-hidden /> Quoted rows use the latest Gmail quote ({fromGmail} of {opps.length}). An order shows its total. “guide” is the form price, not a quote.
        </footer>
        )}
      </section>

      <Section testId="opps-rest" title="Other open deals" count={rest.length} hint="active in the last 60 days">
        <ul className="m-0 p-0 list-none">{rest.map((o) => <Row key={o.job.id} o={o} />)}</ul>
      </Section>
      <Section testId="opps-revive" title="Revive (quiet 60–90 days)" count={revive.length} hint="sorted by value">
        <ul className="m-0 p-0 list-none">{revive.map((o) => <Row key={o.job.id} o={o} />)}</ul>
      </Section>
      <Section testId="opps-abandoned" title="Close as abandoned?" count={abandoned.length} hint="90+ days old, no activity in 90 days">
        <p className="m-0 px-3 py-2 text-[12px] text-gardens-txs border-b border-gardens-bdr">
          Nothing older than 90 days has ever closed. These are never marked lost; abandoning parks them in Archive and they can be reopened.
        </p>
        <ul className="m-0 p-0 list-none">
          {abandoned.map((o) => (
            <li key={o.job.id} data-testid="abandon-row" className="flex items-center gap-3 px-3 py-2 border-b border-gardens-bdr last:border-b-0">
              <span className="font-head text-[14px] font-semibold text-gardens-tx truncate flex-1 min-w-0">{getJobDisplayName(o.job)}</span>
              <span className="text-[12px] text-gardens-txs hidden sm:inline">{o.displayStage} · quiet {o.idleDays}d</span>
              <Value o={o} />
              <button type="button" disabled title="Available once the 'abandoned' exit reason migration is applied" className="h-7 rounded-full px-3 text-xs font-semibold border border-gardens-bdr text-gardens-txm-aa opacity-60 cursor-not-allowed">
                Close as abandoned
              </button>
            </li>
          ))}
        </ul>
      </Section>
      <Section testId="opps-board" title="Board" count={opps.filter((o) => o.bucket !== 'abandoned').length} hint="stage columns">
        <div className="p-2 overflow-x-auto">{board}</div>
      </Section>
    </div>
  );
}
