import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { fetchAllPages } from '@/shared/lib/fetchAllPages';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useOpenOrder } from '@/shared/context/OrderPanelContext';
import { cn } from '@/shared/lib/utils';
import { buildDeals, buildRibbons, MID, OUTCOMES, midOf, outcomeOf, type Deal, type FlowEnquiry, type FlowJob, type FlowOrder } from './leadFlow';

const gbp0 = (n: number) => `£${Math.round(n).toLocaleString('en-GB')}`;
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const all = <T,>(build: (from: number, to: number) => any) => fetchAllPages<T>(build);

function useFlowData() {
  const { organizationId: org } = useOrganization();
  return useQuery({
    queryKey: ['finance-flow', org], enabled: !!org, staleTime: 120_000,
    queryFn: async () => {
      const [jobs, enq, orders] = await Promise.all([
        all<Record<string, any>>((f, t) => supabase.from('jobs').select('id, stage, source, created_at, exit_reason, paid_at, person_id, conversation_id, person:people!jobs_person_id_fkey(first_name, last_name, email, is_test), conversation:inbox_conversations!jobs_conversation_id_fkey(last_outbound_at)').eq('organization_id', org!).order('id').range(f, t)), // eslint-disable-line @typescript-eslint/no-explicit-any
        all<Record<string, any>>((f, t) => supabase.from('enquiries').select('person_id, channel, sub_type, details, order_id, created_at, utm_source, gclid').eq('organization_id', org!).order('id').range(f, t)), // eslint-disable-line @typescript-eslint/no-explicit-any
        all<Record<string, any>>((f, t) => supabase.from('orders').select('id, job_id, value, permit_cost, sku, custom_product_name, deposit_date, installation_date, is_test, archived_at').eq('organization_id', org!).order('id').range(f, t)), // eslint-disable-line @typescript-eslint/no-explicit-any
      ]);
      const { isTestPerson } = await import('@/modules/jobsPipeline/utils/testDeals');
      const fj: FlowJob[] = jobs.filter((j) => !isTestPerson(j.person)).map((j) => ({
        id: j.id, stage: j.stage, source: j.source, created_at: j.created_at, exit_reason: j.exit_reason, paid_at: j.paid_at, person_id: j.person_id,
        person_name: [j.person?.first_name, j.person?.last_name].filter(Boolean).join(' ') || j.person?.email || 'Unknown',
        conversation_id: j.conversation_id, last_outbound_at: j.conversation?.last_outbound_at ?? null,
      }));
      const fe: FlowEnquiry[] = enq.map((e) => ({ person_id: e.person_id, channel: e.channel, sub_type: e.sub_type, product: e.details?.name ?? null, price: e.details?.price != null ? num(e.details.price) : null, order_id: e.order_id, created_at: e.created_at }));
      const fo: FlowOrder[] = orders.filter((o) => !o.is_test && !o.archived_at).map((o) => ({ id: o.id, job_id: o.job_id, value: num(o.value) + num(o.permit_cost), product: o.custom_product_name || o.sku || null, deposit_date: o.deposit_date, installation_date: o.installation_date }));
      return { jobs: fj, enq: fe, orders: fo, tracked: enq.filter((e) => e.utm_source || e.gclid).length };
    },
  });
}

const RANGES = [{ k: '30d', d: 30 }, { k: '90d', d: 90 }, { k: '12m', d: 365 }, { k: 'All', d: 0 }] as const;
const SRC_COLOURS = ['#2F5D8A', '#C2693B', '#5B8C5A', '#8A5A9E', '#B8902F', '#4E8C8C'];
const OUTCOME_COLOUR: Record<string, string> = { 'Deposit paid': '#1F7A4D', Fixed: '#14532D', Open: '#A15C07', Closed: '#B42318', Enquiry: '#6B6359', Quoted: '#6B6359', Invoiced: '#6B6359' };

export const FinanceFlow: React.FC = () => {
  const q = useFlowData();
  const navigate = useNavigate();
  const openOrder = useOpenOrder();
  const [range, setRange] = useState<(typeof RANGES)[number]['k']>('12m');
  const [sel, setSel] = useState<{ title: string; deals: Deal[] } | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const model = useMemo(() => {
    if (!q.data) return null;
    const days = RANGES.find((r) => r.k === range)!.d;
    const since = days ? Date.now() - days * 86_400_000 : 0;
    const deals = buildDeals(q.data.jobs.filter((j) => Date.parse(j.created_at) >= since), q.data.enq, q.data.orders);
    const ribbons = buildRibbons(deals);
    const W = 980, H = 420, NW = 14, GAP = 22;
    const sources = [...new Set(deals.map((d) => d.source))].sort((a, b) => deals.filter((d) => d.source === b).length - deals.filter((d) => d.source === a).length);
    const colour = (src: string) => SRC_COLOURS[sources.indexOf(src) % SRC_COLOURS.length];
    const cols: string[][] = [sources.map((x) => `${x}@0`), MID.map((x) => `${x}@1`), OUTCOMES.map((x) => `${x}@2`)];
    const val = (id: string) => deals.filter((d) => (id.endsWith('@0') ? `${d.source}@0` : id.endsWith('@1') ? `${midOf(d)}@1` : `${outcomeOf(d)}@2`) === id).length;
    const total = deals.length || 1;
    const maxN = Math.max(...cols.map((c) => c.filter((id) => val(id) > 0).length));
    const scale = (H - GAP * (maxN - 1)) / total;
    const X = [4, (W - 230) / 2, W - 230];
    const pos = new Map<string, { x: number; y: number; h: number }>();
    cols.forEach((c, ci) => { let y = 0; for (const id of c) { const n = val(id); if (!n) continue; const h = n * scale; pos.set(id, { x: X[ci], y, h }); y += h + GAP; } });
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
    return { deals, ribbons, pos, paths, W, H, NW, val, colour, sources };
  }, [q.data, range]);

  const products = useMemo(() => {
    if (!q.data) return [];
    const m = new Map<string, { enq: number; won: number; orders: number; value: number }>();
    const g = (k: string) => m.get(k) ?? m.set(k, { enq: 0, won: 0, orders: 0, value: 0 }).get(k)!;
    for (const e of q.data.enq) if (e.product) { const r = g(e.product); r.enq++; if (e.order_id) r.won++; }
    for (const o of q.data.orders) if (o.product && !/^(test|tbc|n\/?a)$/i.test(o.product.trim())) { const r = g(o.product); r.orders++; r.value += o.value; }
    return [...m.entries()].map(([name, r]) => ({ name, ...r })).sort((a, b) => b.orders - a.orders || b.enq - a.enq).slice(0, 12);
  }, [q.data]);

  if (q.isLoading) return <section className="rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3 text-[13px] text-gardens-txs">Loading lead flow…</section>;
  if (q.isError || !model) return <section className="rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3 text-[13px] text-gardens-sem-red">Couldn't load the lead flow.</section>;
  const label = (id: string) => id.split('@')[0];
  const deps = q.data!.enq;
  const utm = q.data!.tracked;

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]" data-testid="finance-flow">
      <section className="rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">Where leads come from and what they become · {model.deals.length} deals</h3>
          <div className="flex gap-1 rounded-lg bg-gardens-page p-1" role="tablist" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.k} type="button" role="tab" aria-selected={range === r.k} onClick={() => { setRange(r.k); setSel(null); }}
                className={cn('rounded-md px-2 py-0.5 text-[12px]', range === r.k ? 'bg-gardens-surf font-bold text-gardens-tx shadow-sm' : 'text-gardens-txs')}>{r.k}</button>
            ))}
          </div>
        </div>
        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${model.W} ${model.H}`} className="w-full min-w-[720px]" role="img" aria-label="Lead flow">
            {model.paths.map(({ r, w, d }, i) => {
              const v = r.deals.reduce((t, x) => t + (x.value ?? 0), 0);
              const base = model.val(r.from);
              const on = hover == null || hover === r.source;
              return (
                <path key={i} d={d} fill="none" stroke={model.colour(r.source)} strokeOpacity={on ? (hover ? 0.75 : 0.45) : 0.08} strokeWidth={Math.max(1, w)}
                  className="cursor-pointer transition-[stroke-opacity]" onMouseEnter={() => setHover(r.source)} onMouseLeave={() => setHover(null)}
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
                  <rect x={p.x} y={p.y} width={model.NW} height={Math.max(2, p.h)} rx={2} fill={col === 0 ? model.colour(label(id)) : OUTCOME_COLOUR[label(id)] ?? 'var(--g-txs, #6b6359)'} />
                  <text x={p.x + model.NW + 5} y={p.y + Math.min(p.h / 2, 14) + 4} fontSize={11.5} fill="var(--g-tx, #1a1815)">
                    <tspan fontWeight={700}>{label(id)}</tspan><tspan dx={5} fill="var(--g-txs, #6b6359)">{n} · {Math.round((n / (model.deals.length || 1)) * 100)}%{v ? ` · ${gbp0(v)}` : ''}</tspan>
                  </text>
                  <title>{`${label(id)}: ${n} deals${v ? ` · ${gbp0(v)}` : ''}`}</title>
                </g>
              );
            })}
          </svg>
        </div>
        <p className="m-0 mt-1 text-[11px] text-gardens-txm-aa">Each colour is one lead source, followed left → right: sources merge into the pipeline (furthest stage reached), then split into outcomes. Hover a source to highlight it; click a ribbon or a node to list those deals. Source = first web form for the person, else the job's source. Ads / FD referral / brochure are not tracked yet (see Data gaps).</p>
        {sel && (
          <div className="mt-2 rounded-lg border border-gardens-bdr" data-testid="flow-selection">
            <div className="flex items-center justify-between bg-gardens-page px-2 py-1 text-[12px]"><b>{sel.title} · {sel.deals.length}</b><button type="button" className="underline text-gardens-txs" onClick={() => setSel(null)}>Clear</button></div>
            <ul className="m-0 max-h-[260px] list-none divide-y divide-gardens-bdr overflow-auto p-0">
              {sel.deals.map((d) => (
                <li key={d.job.id}>
                  <button type="button" className="grid w-full grid-cols-[1fr_auto_auto] gap-3 px-2 py-1.5 text-left text-[12.5px] hover:bg-gardens-page"
                    onClick={() => (d.orderId ? openOrder(d.orderId) : d.job.conversation_id ? navigate(`/dashboard/inbox?conversation=${d.job.conversation_id}`) : null)}>
                    <span className="truncate"><b>{d.job.person_name}</b> <span className="text-gardens-txs">· {d.product ?? 'product unknown'} · {d.source}</span></span>
                    <span className="text-gardens-txs">{d.job.stage}</span>
                    <span className="tabular-nums">{d.value ? gbp0(d.value) : '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <aside className="flex flex-col gap-3">
        <section className="rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3">
          <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">Products · enquiries → orders</h3>
          <table className="mt-1 w-full text-[12px]">
            <thead><tr className="text-left text-gardens-txs"><th className="font-medium">Product</th><th className="text-right font-medium">Enq</th><th className="text-right font-medium">Won</th><th className="text-right font-medium">Orders</th><th className="text-right font-medium">Avg</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.name} className="border-t border-gardens-bdr">
                  <td className="max-w-[120px] truncate py-1" title={p.name}>{p.name}</td>
                  <td className="text-right tabular-nums">{p.enq || '—'}</td>
                  <td className="text-right tabular-nums">{p.enq ? `${Math.round((p.won / p.enq) * 100)}%` : '—'}</td>
                  <td className="text-right tabular-nums">{p.orders || '—'}</td>
                  <td className="text-right tabular-nums">{p.orders ? gbp0(p.value / p.orders) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-1 text-[11px] text-gardens-txm-aa">Enq = web quote forms naming the product · Won = those linked to an order · Orders by SKU / custom name.</p>
        </section>
        <section className="rounded-[10px] border border-gardens-bdr bg-gardens-surf p-3 text-[12px]" data-testid="flow-gaps">
          <h3 className="m-0 text-[11px] font-extrabold uppercase tracking-[0.1em] text-gardens-txm-aa">Data gaps</h3>
          <ul className="m-0 mt-1 list-disc space-y-0.5 pl-4 text-gardens-txs">
            <li>Ads / UTM: {utm} of {deps.length} enquiries carry utm_source or gclid.</li>
            <li>Phone (YOPA), FD referral, brochure: no source field yet.</li>
            <li>Products: only web quote forms name one; contact forms and email don't.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
};
