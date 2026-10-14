import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { fetchAllPages } from '@/shared/lib/fetchAllPages';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { useOpenOrder } from '@/shared/context/OrderPanelContext';
import { cn } from '@/shared/lib/utils';
import { buildDeals, buildLinks, type Deal, type FlowEnquiry, type FlowJob, type FlowOrder } from './leadFlow';

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
const COL_X = [0, 1, 2, 3, 4, 5];
const NODE_COLOUR = (label: string) =>
  label === 'Closed' ? 'var(--g-na-red, #b42318)' : label === 'Still open' || label === 'Not contacted yet' ? 'var(--g-na-amber, #a15c07)' : label === 'Fixed' || label === 'Deposit paid' ? 'var(--g-na-green, #1f7a4d)' : 'var(--g-na-blue, #2f5d8a)';

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
    const links = buildLinks(deals);
    // Layout
    const W = 980, H = 380, NW = 12, PAD = 10;
    const ids = new Set<string>(); links.forEach((l) => { ids.add(l.from); ids.add(l.to); });
    const val = (id: string) => Math.max(links.filter((l) => l.to === id).reduce((s, l) => s + l.deals.length, 0), links.filter((l) => l.from === id).reduce((s, l) => s + l.deals.length, 0));
    const byCol = new Map<number, string[]>();
    for (const id of ids) { const c = Number(id.split('@')[1]); (byCol.get(c) ?? byCol.set(c, []).get(c)!).push(id); }
    const order = (id: string) => { const l = id.split('@')[0]; return l === 'Closed' ? 3 : l === 'Still open' || l === 'Not contacted yet' ? 2 : 1; };
    const total = deals.length || 1;
    const scale = (H - PAD * 6) / total;
    const pos = new Map<string, { x: number; y: number; h: number }>();
    for (const [c, list] of byCol) {
      list.sort((a, b) => order(a) - order(b) || val(b) - val(a));
      let y = 0;
      for (const id of list) { const h = Math.max(2, val(id) * scale); pos.set(id, { x: (COL_X[c] / 5) * (W - 170) + 4, y, h }); y += h + PAD; }
    }
    const outOff = new Map<string, number>(), inOff = new Map<string, number>();
    const paths = links.sort((a, b) => (pos.get(a.to)!.y - pos.get(b.to)!.y)).map((l) => {
      const a = pos.get(l.from)!, b = pos.get(l.to)!, w = Math.max(1, l.deals.length * scale);
      const y0 = a.y + (outOff.get(l.from) ?? 0) + w / 2, y1 = b.y + (inOff.get(l.to) ?? 0) + w / 2;
      outOff.set(l.from, (outOff.get(l.from) ?? 0) + w); inOff.set(l.to, (inOff.get(l.to) ?? 0) + w);
      const x0 = a.x + NW, x1 = b.x, mx = (x0 + x1) / 2;
      return { l, w, d: `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}` };
    });
    const fromTotal = (id: string) => val(id);
    return { deals, links, pos, paths, W, H, NW, val, fromTotal };
  }, [q.data, range]);

  const products = useMemo(() => {
    if (!q.data) return [];
    const m = new Map<string, { enq: number; won: number; orders: number; value: number }>();
    const g = (k: string) => m.get(k) ?? m.set(k, { enq: 0, won: 0, orders: 0, value: 0 }).get(k)!;
    for (const e of q.data.enq) if (e.product) { const r = g(e.product); r.enq++; if (e.order_id) r.won++; }
    for (const o of q.data.orders) if (o.product) { const r = g(o.product); r.orders++; r.value += o.value; }
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
            {model.paths.map(({ l, w, d }, i) => {
              const k = `${l.from}→${l.to}`; const pct = Math.round((l.deals.length / model.fromTotal(l.from)) * 100);
              const v = l.deals.reduce((s, x) => s + (x.value ?? 0), 0);
              return (
                <path key={i} d={d} fill="none" stroke={NODE_COLOUR(label(l.to))} strokeOpacity={hover === k ? 0.55 : 0.22} strokeWidth={w}
                  className="cursor-pointer" onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}
                  onClick={() => setSel({ title: `${label(l.from)} → ${label(l.to)}`, deals: l.deals })}>
                  <title>{`${label(l.from)} → ${label(l.to)}: ${l.deals.length} deals (${pct}% of ${label(l.from)})${v ? ` · ${gbp0(v)}` : ''}`}</title>
                </path>
              );
            })}
            {[...model.pos.entries()].map(([id, p]) => {
              const n = model.val(id); const deals = model.links.filter((l) => l.to === id || (l.from === id && !model.links.some((x) => x.to === id))).flatMap((l) => l.deals);
              const uniq = [...new Map(deals.map((d) => [d.job.id, d])).values()];
              return (
                <g key={id} className="cursor-pointer" onClick={() => setSel({ title: label(id), deals: uniq })}>
                  <rect x={p.x} y={p.y} width={model.NW} height={p.h} rx={2} fill={NODE_COLOUR(label(id))} />
                  <text x={p.x + model.NW + 4} y={p.y + Math.min(p.h / 2, 12) + 4} fontSize={11} fill="var(--g-tx, #1a1815)">
                    <tspan fontWeight={700}>{label(id)}</tspan><tspan dx={4} fill="var(--g-txs, #6b6359)">{n}</tspan>
                  </text>
                  <title>{`${label(id)}: ${n} deals${Number(id.split('@')[1]) > 0 ? ` · ${Math.round((n / (model.deals.length || 1)) * 100)}% of all leads` : ''}`}</title>
                </g>
              );
            })}
          </svg>
        </div>
        <p className="m-0 mt-1 text-[11px] text-gardens-txm-aa">Hover a band for count, value and conversion; click a band or a step to list those deals. Source = first web form for the person, else the job's source. Ads / FD referral / brochure are not tracked yet (see Data gaps).</p>
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
