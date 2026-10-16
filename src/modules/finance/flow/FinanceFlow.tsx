import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { supabase } from '@/shared/lib/supabase';
import { fetchAllPages } from '@/shared/lib/fetchAllPages';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useOpenOrder } from '@/shared/context/orderPanel';
import { useOpenPerson } from '@/shared/context/personPanel';
import { cn } from '@/shared/lib/utils';
import { displayPersonName } from '@/shared/lib/personName';
import { buildDeals, buildRibbons, bySource, groupOf, NOT_RECORDED, MID, OUTCOMES, midOf, outcomeOf, type Deal, type FlowDim, type FlowEnquiry, type FlowJob, type FlowOrder } from './leadFlow';
import { LABEL_PAD, LABEL_PX, NODE_GAP, NODE_W, columnXs, labelBaseline, labelStats, measureLabelWidth, sankeyHeight } from './sankeyLayout';

const gbp0 = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const HOVER_HINT = 'Hover a ribbon for counts, value and conversion; click to list the deals.';

function productCatalog(rows: Array<{ id?: string | null; name?: string | null; sku?: string | null; supplier_sku?: string | null }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const name = row.name?.trim();
    if (!name) continue;
    for (const key of [row.id, row.sku, row.supplier_sku, row.name]) {
      const text = key?.trim().toLowerCase();
      if (text) map.set(text, name);
    }
  }
  return map;
}

function namedProduct(raw: string | null | undefined, catalog: Map<string, string>): string | null {
  const text = raw?.trim() ?? '';
  if (!text || /^(test|tbc|n\/?a)$/i.test(text)) return null;
  return catalog.get(text.toLowerCase()) ?? text;
}
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const all = <T,>(build: (from: number, to: number) => any) => fetchAllPages<T>(build);

function useFlowData() {
  const { organizationId: org } = useOrganization();
  return useQuery({
    queryKey: ['finance-flow', org], enabled: !!org, staleTime: 120_000,
    queryFn: async () => {
      // lead_channel arrives with migration 20261015095256; until it is applied, read without it (enquiry type then comes from enquiries.channel).
      const withChannel = async (cols: (lc: string) => string, run: (sel: string) => Promise<Record<string, any>[]>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        try { return await run(cols(', lead_channel')); } catch (e) { if (/lead_channel/.test(String((e as { message?: string })?.message ?? e))) return run(cols('')); throw e; }
      };
      const [jobs, enq, orders] = await Promise.all([
        withChannel((lc) => `id, stage, source, lead_source${lc}, created_at, exit_reason, paid_at, person_id, conversation_id, person:people!jobs_person_id_fkey(first_name, last_name, email, is_test), conversation:inbox_conversations!jobs_conversation_id_fkey(last_outbound_at)`,
          (sel) => all<Record<string, any>>((f, t) => supabase.from('jobs').select(sel).eq('organization_id', org!).order('id').range(f, t))), // eslint-disable-line @typescript-eslint/no-explicit-any
        withChannel((lc) => `id, person_id, channel, sub_type, lead_source${lc}, order_id, created_at, utm_source, gclid`,
          (sel) => all<Record<string, any>>((f, t) => supabase.from('enquiries').select(sel).eq('organization_id', org!).order('id').range(f, t))), // eslint-disable-line @typescript-eslint/no-explicit-any
        all<Record<string, any>>((f, t) => supabase.from('orders').select('id, job_id, sku, custom_product_name, deposit_date, installation_date, is_test, archived_at').eq('organization_id', org!).order('id').range(f, t)), // eslint-disable-line @typescript-eslint/no-explicit-any
      ]);
      const [amountRows, detailRows, productRows] = await Promise.all([
        supabase.from('order_amounts').select('id, value, permit_cost').eq('organization_id', org!),
        supabase.from('enquiry_details_safe').select('id, details').eq('organization_id', org!),
        supabase.from('products').select('id, name, sku, supplier_sku').eq('organization_id', org!),
      ]);
      const amountById = new Map((amountRows.data ?? []).map((row) => [row.id as string, row]));
      const detailById = new Map((detailRows.data ?? []).map((row) => [row.id as string, row.details]));
      for (const order of orders) {
        const amount = amountById.get(order.id as string);
        order.value = amount?.value ?? null;
        order.permit_cost = amount?.permit_cost ?? null;
      }
      for (const enquiry of enq) enquiry.details = detailById.get(enquiry.id as string) ?? null;
      // Google Ads daily spend (migration 20261015095256 + daily Ads pull). Missing table/rows → null, shown as "not loaded".
      const spendRes = await supabase.from('ads_spend_daily').select('day, cost_gbp').eq('organization_id', org!).limit(5000);
      const spend: { day: string; cost: number }[] | null = spendRes.error || !spendRes.data?.length ? null : spendRes.data.map((r: Record<string, any>) => ({ day: r.day, cost: num(r.cost_gbp) })); // eslint-disable-line @typescript-eslint/no-explicit-any
      const { isTestPerson } = await import('@/modules/jobsPipeline/utils/testDeals');
      const fj: FlowJob[] = jobs.filter((j) => !isTestPerson(j.person)).map((j) => ({
        id: j.id, stage: j.stage, source: j.source, created_at: j.created_at, exit_reason: j.exit_reason, paid_at: j.paid_at, person_id: j.person_id,
        person_name: displayPersonName(j.person?.first_name, j.person?.last_name) || j.person?.email || 'Unknown',
        conversation_id: j.conversation_id, last_outbound_at: j.conversation?.last_outbound_at ?? null, lead_source: j.lead_source ?? null, lead_channel: j.lead_channel ?? null,
      }));
      const fe: FlowEnquiry[] = enq.map((e) => ({ person_id: e.person_id, channel: e.channel, lead_source: e.lead_source ?? null, lead_channel: e.lead_channel ?? null, sub_type: e.sub_type, product: e.details?.name ?? null, price: e.details?.price != null ? num(e.details.price) : null, order_id: e.order_id, created_at: e.created_at }));
      const fo: FlowOrder[] = orders.filter((o) => !o.is_test && !o.archived_at).map((o) => ({ id: o.id, job_id: o.job_id, value: num(o.value) + num(o.permit_cost), product: o.custom_product_name || o.sku || null, deposit_date: o.deposit_date, installation_date: o.installation_date }));
      return { jobs: fj, enq: fe, orders: fo, spend, tracked: enq.filter((e) => e.utm_source || e.gclid).length, catalog: productCatalog(productRows.error ? [] : productRows.data ?? []) };
    },
  });
}

const RANGES = [{ k: '30d', d: 30 }, { k: '90d', d: 90 }, { k: '12m', d: 365 }, { k: 'All', d: 0 }] as const;
/** One fixed colour per enquiry type (lead_channel), from the --g-type-* tokens. */
const TYPE_COLOUR: Record<string, string> = { RAQ: 'var(--g-type-raq)', 'Contact form': 'var(--g-type-contact)', Brochure: 'var(--g-type-brochure)', 'Web chat': 'var(--g-type-chat)', Call: 'var(--g-type-call)', Email: 'var(--g-type-email)', [NOT_RECORDED]: 'var(--g-type-none)' };
// One fixed colour per lead source so the Sankey, the table and other pages agree.
const SOURCE_COLOUR: Record<string, string> = { 'Google Ads': '#2F5D8A', Organic: '#5B8C5A', 'Funeral director': '#8A5A9E', Referral: '#B8902F', Repeat: '#4E8C8C', Unknown: 'var(--g-status-grey)', [NOT_RECORDED]: '#C9C4BA' };
/** Outcome nodes use the status tokens (styles/tokens.css): green done/paid, amber open (our move), red abandoned, neutral text colour for in-progress stages. */
const OUTCOME_COLOUR: Record<string, string> = {
  'Deposit paid': 'var(--g-status-green)',
  Fixed: 'var(--g-status-green-dk)',
  Open: 'var(--g-status-amber)',
  Abandoned: 'var(--g-status-red)',
  Enquiry: 'var(--g-txs)',
  Quoted: 'var(--g-txs)',
  Invoiced: 'var(--g-txs)',
};

export const FinanceFlow: React.FC = () => {
  const q = useFlowData();
  const openOrder = useOpenOrder();
  const [range, setRange] = useState<(typeof RANGES)[number]['k']>('12m');
  const [sel, setSel] = useState<{ title: string; deals: Deal[] } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [hoverPath, setHoverPath] = useState<number | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const openPerson = useOpenPerson();
  const [prodSort, setProdSort] = useState<'orders' | 'enq'>('orders');
  const [dim, setDim] = useState<FlowDim>('channel');
  const plotRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState(0);
  const [plotH, setPlotH] = useState(0);
  const canvasW = chartW > 0 ? chartW : 720;

  useEffect(() => {
    const el = plotRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const apply = () => {
      const w = Math.floor(el.clientWidth);
      const h = Math.floor(el.clientHeight);
      if (w > 0) setChartW((prev) => (prev === w ? prev : w));
      if (h > 0) setPlotH((prev) => (prev === h ? prev : h));
    };
    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    return () => ro.disconnect();
  }, [q.data]);

  const model = useMemo(() => {
    if (!q.data) return null;
    const days = RANGES.find((r) => r.k === range)!.d;
    const since = days ? Date.now() - days * 86_400_000 : 0;
    const deals = buildDeals(q.data.jobs.filter((j) => Date.parse(j.created_at) >= since), q.data.enq, q.data.orders);
    const ribbons = buildRibbons(deals, dim);
    const grp = (d: Deal) => groupOf(d, dim);
    const sources = [...new Set(deals.map(grp))].sort((a, b) => (a === NOT_RECORDED ? 1 : 0) - (b === NOT_RECORDED ? 1 : 0) || deals.filter((d) => grp(d) === b).length - deals.filter((d) => grp(d) === a).length);
    const colour = (src: string) => (dim === 'channel' ? TYPE_COLOUR : SOURCE_COLOUR)[src] ?? 'var(--g-status-grey)';
    const cols: string[][] = [sources.map((x) => `${x}@0`), MID.map((x) => `${x}@1`), OUTCOMES.map((x) => `${x}@2`)];
    const val = (id: string) => deals.filter((d) => (id.endsWith('@0') ? `${grp(d)}@0` : id.endsWith('@1') ? `${midOf(d)}@1` : `${outcomeOf(d)}@2`) === id).length;
    const total = deals.length || 1;
    const nodeValue = (id: string) => deals.filter((d) => (id.endsWith('@0') ? `${grp(d)}@0` : id.endsWith('@1') ? `${midOf(d)}@1` : `${outcomeOf(d)}@2`) === id).reduce((t, d) => t + (d.value ?? 0), 0);
    const labelWidths: [number, number, number] = [0, 0, 0];
    for (const col of cols) {
      for (const id of col) {
        const n = val(id);
        if (!n) continue;
        const ci = Number(id.split('@')[1]) as 0 | 1 | 2;
        const w = measureLabelWidth(id.split('@')[0], labelStats(n, total, nodeValue(id), gbp0));
        if (w > labelWidths[ci]) labelWidths[ci] = w;
      }
    }
    const placed = columnXs(canvasW, labelWidths);
    const maxN = Math.max(1, ...cols.map((c) => c.filter((id) => val(id) > 0).length));
    const minPlot = sankeyHeight(maxN) + LABEL_PAD;
    const baseH = plotH >= minPlot ? plotH : minPlot;
    const stackH = baseH - LABEL_PAD;
    const NW = NODE_W;
    const W = placed.width;
    const X = placed.x;
    const scale = Math.max(0, (stackH - NODE_GAP * (maxN - 1)) / total);
    const pos = new Map<string, { x: number; y: number; h: number }>();
    const minNode = LABEL_PX + 6;
    let stackUsed = 0;
    cols.forEach((c, ci) => {
      let y = 0;
      for (const id of c) {
        const n = val(id);
        if (!n) continue;
        const h = Math.max(minNode, n * scale);
        pos.set(id, { x: X[ci], y, h });
        y += h + NODE_GAP;
      }
      if (y > stackUsed) stackUsed = y;
    });
    const H = Math.max(baseH, stackUsed + 4);
    // Stack ribbons inside each node in source order so a colour can be followed left → right.
    const outOff = new Map<string, number>(), inOff = new Map<string, number>();
    const rank = (id: string) => cols.flat().indexOf(id);
    const sorted = [...ribbons].sort((a, b) => rank(a.from) - rank(b.from) || sources.indexOf(a.source) - sources.indexOf(b.source) || rank(a.to) - rank(b.to));
    const paths = sorted.map((r) => {
      const a = pos.get(r.from)!, b = pos.get(r.to)!, w = r.deals.length * scale;
      const y0 = a.y + (outOff.get(r.from) ?? 0) + w / 2; outOff.set(r.from, (outOff.get(r.from) ?? 0) + w);
      return { r, w, a, b, y0 };
    }).sort((p1, p2) => sources.indexOf(p1.r.source) - sources.indexOf(p2.r.source) || rank(p1.r.from) - rank(p2.r.from)).map((p) => {
      const y1 = p.b.y + (inOff.get(p.r.to) ?? 0) + p.w / 2; inOff.set(p.r.to, (inOff.get(p.r.to) ?? 0) + p.w);
      const x0 = p.a.x + NW, x1 = p.b.x, mx = (x0 + x1) / 2;
      return { ...p, d: `M${x0},${p.y0} C${mx},${p.y0} ${mx},${y1} ${x1},${y1}` };
    });
    const spendDays = q.data.spend?.filter((r) => !days || Date.parse(r.day) >= since) ?? null;
    const adsSpend = spendDays ? spendDays.reduce((t, r) => t + r.cost, 0) : null;
    const table = bySource(deals, adsSpend, dim);
    return { deals, ribbons, pos, paths, W, H, NW, val, colour, sources, table, adsSpend, minPlot };
  }, [q.data, range, dim, canvasW, plotH]);

  const products = useMemo(() => {
    if (!q.data) return [];
    const catalog = q.data.catalog ?? new Map<string, string>();
    const m = new Map<string, { enq: number; orders: number; value: number }>();
    const g = (k: string) => m.get(k) ?? m.set(k, { enq: 0, orders: 0, value: 0 }).get(k)!;
    for (const e of q.data.enq) {
      const name = namedProduct(e.product, catalog);
      if (name) g(name).enq++;
    }
    for (const o of q.data.orders) {
      const name = namedProduct(o.product, catalog);
      if (!name) continue;
      const r = g(name);
      r.orders++;
      r.value += o.value;
    }
    return [...m.entries()].map(([name, r]) => ({ name, ...r })).sort((a, b) => (prodSort === 'orders' ? b.orders - a.orders || b.enq - a.enq : b.enq - a.enq || b.orders - a.orders)).slice(0, 12);
  }, [q.data, prodSort]);

  if (q.isLoading) return <section className="rounded-lg border border-gardens-bdr bg-gardens-surf p-3 text-[13px] text-gardens-txs">Loading lead flow…</section>;
  if (q.isError || !model) return <section className="rounded-lg border border-gardens-bdr bg-gardens-surf p-3 text-[13px] text-gardens-sem-red">Couldn't load the lead flow.</section>;
  const label = (id: string) => id.split('@')[0];
  const deps = q.data!.enq;
  const utm = q.data!.tracked;

  return (
    <div className="finance-split" data-testid="finance-flow">
    <div className="finance-split__grid">
      <section className="finance-split__chart flex min-w-0 flex-col rounded-lg border border-gardens-bdr bg-gardens-surf px-2.5 py-2" data-testid="flow-chart">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="m-0 min-w-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">Leads by {dim === 'channel' ? 'enquiry type' : 'lead source'} and what they become · {model.deals.length} deals</h3>
            <button type="button" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gardens-txm-aa" aria-label={HOVER_HINT} title={HOVER_HINT} data-testid="flow-hover">
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
            <details className="min-w-0 text-[11px] text-gardens-txm-aa">
              <summary className="cursor-pointer select-none">How to read this chart</summary>
              <p className="m-0 mt-1 max-w-prose">Each colour is one {dim === 'channel' ? 'enquiry type' : 'lead source'}, followed left → right: they merge into the pipeline (furthest stage reached), then split into outcomes. Hover one to highlight it; click a ribbon or a node to list those deals. {dim === 'channel'
                ? <>Type = the job's lead channel, else the first enquiry's, else the web form kind (quote → RAQ, contact → Contact form); “Not recorded” when none.</>
                : <>Source = the job's lead source, else the person's first enquiry's lead source (“Not recorded” when neither has one).</>}</p>
            </details>
          </div>
          <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-lg bg-gardens-page p-1" role="tablist" aria-label="Group leads by" data-testid="flow-dim">
            {(['channel', 'source'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={dim === k} onClick={() => { setDim(k); setSel(null); setHover(null); }}
                className={cn('rounded-md px-2 py-0.5 text-[12px]', dim === k ? 'bg-gardens-surf font-bold text-gardens-tx shadow-sm' : 'text-gardens-txs')}>{k === 'channel' ? 'By type' : 'By source'}</button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg bg-gardens-page p-1" role="tablist" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.k} type="button" role="tab" aria-selected={range === r.k} onClick={() => { setRange(r.k); setSel(null); }}
                className={cn('rounded-md px-2 py-0.5 text-[12px]', range === r.k ? 'bg-gardens-surf font-bold text-gardens-tx shadow-sm' : 'text-gardens-txs')}>{r.k}</button>
            ))}
          </div>
          </div>
        </div>
        <p className="sr-only" aria-live="polite">{info ?? ''}</p>
        <div className="mt-2 flex flex-col gap-3 lg:hidden" data-testid="flow-stages">
          {(['@0', '@1', '@2'] as const).map((suffix) => {
            const ids = [...model.pos.keys()].filter((id) => id.endsWith(suffix));
            if (!ids.length) return null;
            const title = suffix === '@0' ? (dim === 'channel' ? 'Enquiry type' : 'Lead source') : suffix === '@1' ? 'Pipeline' : 'Outcome';
            const maxCount = Math.max(...ids.map((id) => model.val(id)));
            return (
              <div key={suffix}>
                <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">{title}</p>
                <ul className="m-0 list-none p-0">
                  {ids.map((id) => {
                    const n = model.val(id);
                    const deals = model.deals.filter((d) => (id.endsWith('@0') ? `${groupOf(d, dim)}@0` : id.endsWith('@1') ? `${midOf(d)}@1` : `${outcomeOf(d)}@2`) === id);
                    const v = deals.reduce((t, x) => t + (x.value ?? 0), 0);
                    const col = Number(id.split('@')[1]);
                    const stats = `${n} · ${Math.round((n / (model.deals.length || 1)) * 100)}%${v ? ` · ${gbp0(v)}` : ''}`;
                    return (
                      <li key={id} className="mt-1.5" data-testid="flow-stage">
                        <button type="button" className="w-full text-left" onClick={() => setSel({ title: label(id), deals })}>
                          <span className="flex flex-wrap items-baseline gap-x-1.5 text-[14px] leading-snug text-gardens-tx">
                            <span className="font-bold">{label(id)}</span>
                            <span className="text-gardens-txs">{stats}</span>
                          </span>
                          <span className="mt-1 block h-2 overflow-hidden rounded-full bg-gardens-page" aria-hidden>
                            <span className="block h-full rounded-full" style={{ width: `${Math.max(8, Math.round((n / maxCount) * 100))}%`, background: col === 0 ? model.colour(label(id)) : OUTCOME_COLOUR[label(id)] ?? 'var(--g-txs)' }} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <div ref={plotRef} className="relative mt-1 hidden w-full min-w-0 flex-1 lg:block" style={{ minHeight: model.minPlot }} data-testid="flow-chart-plot">
          <svg viewBox={`0 0 ${model.W} ${model.H}`} className="absolute inset-0 h-full w-full" role="img" aria-label="Lead flow" data-testid="flow-chart-svg">
            {model.paths.map(({ r, w, d }, i) => {
              const v = r.deals.reduce((t, x) => t + (x.value ?? 0), 0);
              const base = model.val(r.from);
              const on = hover == null || hover === r.source;
              return (
                <path key={i} d={d} fill="none" stroke={model.colour(r.source)} data-testid="flow-ribbon"
                  strokeOpacity={hoverPath === i ? 0.9 : on ? (hover ? 0.6 : 0.45) : 0.08} strokeWidth={Math.max(1, w)}
                  className="cursor-pointer transition-[stroke-opacity]"
                  onMouseEnter={() => {
                    setHover(r.source); setHoverPath(i);
                    const srcDeals = model.deals.filter((x) => groupOf(x, dim) === r.source);
                    const won = srcDeals.filter((x) => x.reached >= 4).length;
                    setInfo(`${r.source}: ${label(r.from)} → ${label(r.to)} · ${r.deals.length} deals${v ? ` · ${gbp0(v)}` : ''} · ${Math.round((r.deals.length / (base || 1)) * 100)}% of ${label(r.from)} · ${dim === 'channel' ? 'type' : 'source'} converts ${won}/${srcDeals.length} (${Math.round((won / (srcDeals.length || 1)) * 100)}%) to deposit`);
                  }}
                  onMouseLeave={() => { setHover(null); setHoverPath(null); setInfo(null); }}
                  onClick={() => setSel({ title: `${r.source}: ${label(r.from)} → ${label(r.to)}`, deals: r.deals })}>
                  <title>{`${r.source}: ${label(r.from)} → ${label(r.to)} · ${r.deals.length} deals (${Math.round((r.deals.length / (base || 1)) * 100)}% of ${label(r.from)})${v ? ` · ${gbp0(v)}` : ''}`}</title>
                </path>
              );
            })}
            {[...model.pos.entries()].map(([id, p]) => {
              const col = Number(id.split('@')[1]); const n = model.val(id);
              const deals = model.deals.filter((d) => model.ribbons.some((r) => (r.from === id || r.to === id) && r.deals.includes(d)));
              const v = deals.reduce((t, x) => t + (x.value ?? 0), 0);
              return (
                <g key={id} className="cursor-pointer" onClick={() => setSel({ title: label(id), deals })}
                  onMouseEnter={() => col === 0 && setHover(label(id))} onMouseLeave={() => col === 0 && setHover(null)}>
                  <rect x={p.x} y={p.y} width={model.NW} height={Math.max(2, p.h)} rx={2} fill={col === 0 ? model.colour(label(id)) : OUTCOME_COLOUR[label(id)] ?? 'var(--g-txs)'} />
                  <text x={p.x + model.NW + 6} y={labelBaseline(p.y, p.h, model.H)} fontSize={LABEL_PX} fill="var(--g-tx, #1a1815)" stroke="var(--g-surf, #fdfbf6)" strokeWidth={4} paintOrder="stroke">
                    <tspan fontWeight={700}>{label(id)}</tspan><tspan dx={5} fill="var(--g-txs, #6b6359)">{n} · {Math.round((n / (model.deals.length || 1)) * 100)}%{v ? ` · ${gbp0(v)}` : ''}</tspan>
                  </text>
                  <title>{`${label(id)}: ${n} deals${v ? ` · ${gbp0(v)}` : ''}`}</title>
                </g>
              );
            })}
          </svg>
        </div>
        {sel && (
          <div className="mt-2 shrink-0 rounded-lg border border-gardens-bdr" data-testid="flow-selection">
            <div className="flex items-center justify-between bg-gardens-page px-2 py-1 text-[12px]"><b>{sel.title} · {sel.deals.length}</b><button type="button" className="underline text-gardens-txs" onClick={() => setSel(null)}>Clear</button></div>
            <ul className="m-0 max-h-[260px] min-w-0 list-none divide-y divide-gardens-bdr overflow-y-auto p-0 xl:max-h-[22vh]">
              {sel.deals.map((d) => (
                <li key={d.job.id}>
                  <button type="button" className="grid w-full grid-cols-[1fr_auto_auto] gap-3 px-2 py-1.5 text-left text-[12.5px] hover:bg-gardens-page"
                    onClick={() => (d.orderId ? openOrder(d.orderId) : openPerson({ personId: d.job.person_id, conversationId: d.job.conversation_id, name: d.job.person_name }))}>
                    <span className="truncate"><b>{d.job.person_name}</b> <span className="text-gardens-txs">· {d.product ?? 'product unknown'} · {d.channel} · {d.source}</span></span>
                    <span className="text-gardens-txs">{d.job.stage}</span>
                    <span className="tabular-nums">{d.value ? gbp0(d.value) : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <aside className="flex w-full min-w-0 flex-col gap-2">
        <section className="w-full min-w-0 rounded-lg border border-gardens-bdr bg-gardens-surf px-2.5 py-2" data-testid="finance-by-source">
          <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">By {dim === 'channel' ? 'enquiry type' : 'lead source'} · {range}</h3>
          <table className="mt-1 w-full text-[13px]">
            <thead><tr className="text-left text-gardens-txs"><th className="py-1 pr-3 font-medium">{dim === 'channel' ? 'Type' : 'Source'}</th><th className="px-2 py-1 text-right font-medium">Leads</th><th className="px-2 py-1 text-right font-medium">Quotes</th><th className="px-2 py-1 text-right font-medium">Dep</th><th className="py-1 pl-2 text-right font-medium" title="Order value (value + permit) of deals with a deposit">Revenue</th></tr></thead>
            <tbody>
              {model.table.map((r) => (
                <tr key={r.source} className={cn('cursor-pointer border-t border-gardens-bdr', hover && hover !== r.source && 'opacity-50')} data-testid="by-source-row"
                  onMouseEnter={() => setHover(r.source)} onMouseLeave={() => setHover(null)}
                  onClick={() => setSel({ title: r.source, deals: model.deals.filter((d) => groupOf(d, dim) === r.source) })}>
                  <td className="break-words py-1 pr-3" title={r.source}><span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: model.colour(r.source) }} aria-hidden />{r.source}</td>
                  <td className="px-2 text-right tabular-nums">{r.leads}</td>
                  <td className="px-2 text-right tabular-nums">{r.quotes}</td>
                  <td className="px-2 text-right tabular-nums">{r.deposits}</td>
                  <td className="pl-2 text-right tabular-nums">{r.revenue ? gbp0(r.revenue) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {dim === 'source' && (
            <p className="m-0 mt-1 text-[11px] text-gardens-txs" data-testid="ads-spend">Google Ads spend {model.adsSpend == null ? 'not loaded' : gbp0(model.adsSpend)}{model.adsSpend != null && (() => { const g = model.table.find((r) => r.source === 'Google Ads'); return g ? ` · cost per deposit ${g.costPerDeposit != null ? gbp0(g.costPerDeposit) : 'no deposits'}` : ''; })()}</p>
          )}
          <p className="m-0 mt-1 text-[11px] text-gardens-txm-aa" title="Leads = deals created in the range · Quotes = reached Quoted or later · Dep = deposit paid · Revenue = order value + permit of those deposits. Hover a row to highlight it in the flow.">Dep = deposit paid · Revenue = value + permit</p>
        </section>
        <section className="w-full min-w-0 rounded-lg border border-gardens-bdr bg-gardens-surf px-2.5 py-2" data-testid="top-products">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">Top products</h3>
            <div className="flex gap-1 rounded-md bg-gardens-page p-1 text-[11px]" role="tablist" aria-label="Rank products by">
              {(['orders', 'enq'] as const).map((k) => (
                <button key={k} type="button" role="tab" aria-selected={prodSort === k} onClick={() => setProdSort(k)}
                  className={cn('rounded px-2', prodSort === k ? 'bg-gardens-surf font-bold text-gardens-tx' : 'text-gardens-txs')}>{k === 'orders' ? 'By orders' : 'By enquiries'}</button>
              ))}
            </div>
          </div>
          <table className="mt-1 w-full text-[13px]">
            <thead><tr className="text-left text-gardens-txs"><th className="py-1 pr-3 font-medium">Product</th><th className="px-2 py-1 text-right font-medium">Enq</th><th className="px-2 py-1 text-right font-medium" title="Orders divided by enquiries, capped at 100%">Conv</th><th className="px-2 py-1 text-right font-medium">Orders</th><th className="py-1 pl-2 text-right font-medium">Avg</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.name} className="border-t border-gardens-bdr">
                  <td className="break-words py-1 pr-3" title={p.name}>{p.name}</td>
                  <td className="px-2 text-right tabular-nums">{p.enq || '—'}</td>
                  <td className="px-2 text-right tabular-nums">{p.enq ? `${Math.min(100, Math.round((p.orders / p.enq) * 100))}%` : '—'}</td>
                  <td className="px-2 text-right tabular-nums">{p.orders || '—'}</td>
                  <td className="pl-2 text-right tabular-nums">{p.orders ? gbp0(p.value / p.orders) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-1 text-[11px] text-gardens-txm-aa" title="Enq = web quote forms naming the product · Conv = orders ÷ enquiries, capped at 100% · Avg = average order value (value + permit).">Enq = quote forms · Conv = orders ÷ enquiries · Avg = value + permit</p>
        </section>
        <details className="w-full shrink-0 rounded-lg border border-gardens-bdr bg-gardens-surf px-2.5 py-2 text-[12px]" data-testid="flow-gaps">
          <summary className="cursor-pointer select-none text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">Data gaps</summary>
          <ul className="m-0 mt-1 list-disc space-y-0.5 break-words pl-4 text-gardens-txs">
            <li>Ads / UTM: {utm} of {deps.length} enquiries carry utm_source or gclid.</li>
            <li>Lead source: {deps.filter((e) => e.lead_source).length} of {deps.length} enquiries have one (backfill pending approval).</li>
            <li>Ads spend: {q.data!.spend ? `${q.data!.spend.length} days loaded` : 'not loaded (ads_spend_daily)'}.</li>
            <li>Products: only web quote forms name one; contact forms and email don't.</li>
            <li>Fixed: 0 of 49 orders have an installation date, so nothing can reach 'Fixed'.</li>
            <li>Abandoned: only 4 jobs carry exit_reason; quiet deals stay 'Open'.</li>
          </ul>
        </details>
      </aside>
    </div>
    </div>
  );
};
