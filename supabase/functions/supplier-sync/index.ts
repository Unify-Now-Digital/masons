/**
 * Daily Ogee read. Make calls this once a day. pg_cron is not installed.
 *
 * Auth: header `x-supplier-cron-secret: <SUPPLIER_CRON_SECRET>`.
 * verify_jwt is false — Make cannot send a Supabase JWT. A plain deploy
 * re-enables JWT verification and Make gets 401 before this code runs.
 * Deploy with `supabase functions deploy supplier-sync --no-verify-jwt`.
 *
 * Body:
 *   { "organization_id": "<uuid>", "complete": true, "items": [ ... ] }
 * When `items` is omitted, the function reads Monday board 895721886 with
 * MONDAY_API_TOKEN (paged). Make can instead send the items it already read.
 * Send `"complete": true` on the last page so jobs missing from this read
 * are marked stale. A full Monday read always completes.
 *
 * Secrets: SUPPLIER_CRON_SECRET, and MONDAY_API_TOKEN if Mason reads Monday.
 * The organisation id is in the body. It is not hardcoded.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import { logActivityEvent } from '../_shared/activityEvent.ts';
import { timingSafeEqual } from '../_shared/revolut/webhookSignature.ts';
import {
  OGEE_BOARD_ID,
  groupJobs,
  parseBoardItems,
  planLinks,
  type JobDraft,
  type MasonOrderRef,
  type RawBoardItem,
} from '../_shared/supplierStatus.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-supplier-cron-secret',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function authorized(req: Request): boolean {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token && service && timingSafeEqual(token, service)) return true;
  const expected = Deno.env.get('SUPPLIER_CRON_SECRET') ?? '';
  const got = req.headers.get('x-supplier-cron-secret') ?? '';
  return !!expected && !!got && timingSafeEqual(got, expected);
}

interface SyncBody {
  organization_id?: string;
  complete?: boolean;
  items?: RawBoardItem[];
}

const MONDAY_QUERY = `query ($board: [ID!], $cursor: String) {
  boards(ids: $board) {
    items_page(limit: 100, cursor: $cursor) {
      cursor
      items {
        id
        name
        group { title }
        column_values { id text column { title } }
        subitems { id name column_values { id text column { title } } }
      }
    }
  }
}`;

async function readMonday(boardId: string, token: string): Promise<RawBoardItem[]> {
  const items: RawBoardItem[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page++) {
    const res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
        'API-Version': '2024-10',
      },
      body: JSON.stringify({ query: MONDAY_QUERY, variables: { board: [boardId], cursor } }),
    });
    if (!res.ok) throw new Error('monday_http');
    const body = await res.json() as {
      errors?: { message?: string }[];
      data?: { boards?: { items_page?: { cursor?: string | null; items?: RawBoardItem[] } }[] };
    };
    if (body.errors?.length) throw new Error('monday_query');
    const pageItems = body.data?.boards?.[0]?.items_page;
    items.push(...(pageItems?.items ?? []));
    cursor = pageItems?.cursor ?? null;
    if (!cursor) break;
  }
  return items;
}

interface ExistingJob {
  id: string;
  board_item_id: string;
  normalized_status: string | null;
  job_code: string | null;
}

interface ExistingLink {
  id: string;
  order_id: string;
  job_id: string;
  link_status: string;
  rule: string;
}

interface OrderRow {
  id: string;
  order_number: number | null;
  customer_name: string | null;
  person_name: string | null;
  custom_product_name: string | null;
  product_id: string | null;
}

type Admin = ReturnType<typeof createClient>;

async function pageRows<T>(load: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < 8000; from += 1000) {
    const { data, error } = await load(from, from + 999);
    if (error) throw new Error('read_failed');
    const chunk = data ?? [];
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return rows;
}

async function applySync(
  supabase: Admin,
  organizationId: string,
  boardId: string,
  drafts: JobDraft[],
  complete: boolean,
): Promise<{ jobs: number; linked: number; suggested: number; changed: number }> {
  const existing = await pageRows<ExistingJob>((from, to) => supabase
    .from('supplier_jobs')
    .select('id, board_item_id, normalized_status, job_code')
    .eq('organization_id', organizationId)
    .eq('board_id', boardId)
    .range(from, to));
  const existingByItem = new Map(existing.map((row) => [row.board_item_id, row]));
  const orders = await pageRows<OrderRow>((from, to) => supabase
    .from('orders')
    .select('id, order_number, customer_name, person_name, custom_product_name, product_id')
    .eq('organization_id', organizationId)
    .is('archived_at', null)
    .range(from, to));
  const productIds = [...new Set(orders.map((order) => order.product_id).filter((id): id is string => !!id))];
  const productNames = new Map<string, string>();
  if (productIds.length) {
    const { data } = await supabase.from('products').select('id, name').in('id', productIds.slice(0, 500));
    for (const product of data ?? []) {
      if (product?.id && product?.name) productNames.set(product.id, product.name);
    }
  }
  const orderRefs: MasonOrderRef[] = orders.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    personName: order.person_name,
    productName: order.custom_product_name || (order.product_id ? productNames.get(order.product_id) ?? null : null),
  }));

  const seen = new Set<string>();
  const changes: { job_code: string | null; from: string | null; to: string | null }[] = [];
  let linked = 0;
  let suggested = 0;
  const now = new Date().toISOString();

  for (const draft of drafts) {
    seen.add(draft.boardItemId);
    const previous = existingByItem.get(draft.boardItemId);
    if (previous && previous.normalized_status !== draft.normalizedStatus) {
      changes.push({ job_code: draft.jobCode, from: previous.normalized_status, to: draft.normalizedStatus });
    }
    const { data: saved, error } = await supabase
      .from('supplier_jobs')
      .upsert({
        organization_id: organizationId,
        board_id: boardId,
        board_item_id: draft.boardItemId,
        job_code: draft.jobCode,
        customer_reference: draft.customerReference,
        batch_code: draft.batchCode,
        container_code: draft.containerCode,
        status: draft.normalizedStatus,
        normalized_status: draft.normalizedStatus,
        delivery_sch: draft.deliverySch,
        delivery_date: draft.deliveryDate,
        delivery_estimate: draft.deliveryEstimate,
        group_title: draft.groupTitle,
        synced_at: now,
        stale: false,
      }, { onConflict: 'organization_id,board_id,board_item_id' })
      .select('id')
      .single();
    if (error || !saved?.id) throw new Error('write_failed');
    const jobId = saved.id as string;
    const { error: deleteError } = await supabase
      .from('supplier_parts')
      .delete()
      .eq('organization_id', organizationId)
      .eq('job_id', jobId);
    if (deleteError) throw new Error('write_failed');
    if (draft.parts.length) {
      const { error: partError } = await supabase.from('supplier_parts').insert(draft.parts.map((part) => ({
        organization_id: organizationId,
        job_id: jobId,
        board_item_id: part.boardItemId,
        description: part.description,
        status: part.statusRaw,
        normalized_status: part.normalizedStatus,
        synced_at: now,
      })));
      if (partError) throw new Error('write_failed');
    }

    const { data: currentLinks, error: linkReadError } = await supabase
      .from('order_supplier_links')
      .select('id, order_id, job_id, link_status, rule')
      .eq('organization_id', organizationId)
      .eq('job_id', jobId);
    if (linkReadError) throw new Error('write_failed');
    const links = (currentLinks ?? []) as ExistingLink[];
    for (const plan of planLinks(draft.customerReference, orderRefs)) {
      const found = links.find((link) => link.order_id === plan.orderId);
      if (!found) {
        const { error: insertError } = await supabase.from('order_supplier_links').insert({
          organization_id: organizationId,
          order_id: plan.orderId,
          job_id: jobId,
          confidence: plan.confidence,
          rule: plan.rule,
          link_status: plan.linkStatus,
        });
        if (insertError) throw new Error('write_failed');
        if (plan.linkStatus === 'auto') linked += 1;
        else suggested += 1;
        continue;
      }
      if (found.link_status === 'rejected' || found.link_status === 'confirmed') continue;
      if (found.link_status === plan.linkStatus && found.rule === plan.rule) continue;
      const { error: updateError } = await supabase
        .from('order_supplier_links')
        .update({ link_status: plan.linkStatus, confidence: plan.confidence, rule: plan.rule })
        .eq('id', found.id)
        .eq('organization_id', organizationId);
      if (updateError) throw new Error('write_failed');
    }
  }

  if (complete) {
    const missing = existing.filter((row) => !seen.has(row.board_item_id)).map((row) => row.id);
    if (missing.length) {
      const { error } = await supabase
        .from('supplier_jobs')
        .update({ stale: true })
        .eq('organization_id', organizationId)
        .in('id', missing);
      if (error) throw new Error('write_failed');
    }
  }

  if (complete && existing.length > 0 && changes.length) {
    const day = now.slice(0, 10);
    await logActivityEvent(supabase, {
      organizationId,
      type: 'stone.digest',
      category: 'supplier',
      priority: 'fyi',
      title: `Ogee: ${changes.length} jobs changed`,
      actorType: 'supplier',
      dedupeKey: `stone:digest:${day}`,
      payload: { children: changes.slice(0, 40) },
    });
  }

  return { jobs: drafts.length, linked, suggested, changed: changes.length };
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!authorized(req)) {
    const expected = Deno.env.get('SUPPLIER_CRON_SECRET') ?? '';
    if (!expected) return json({ error: 'server_config' }, 503);
    return json({ error: 'unauthorized' }, 401);
  }

  let body: SyncBody;
  try {
    body = await req.json() as SyncBody;
  } catch {
    body = {};
  }
  const organizationId = (body.organization_id ?? '').trim();
  if (!UUID.test(organizationId)) return json({ error: 'organisation_id is required' }, 400);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) return json({ error: 'server_config' }, 503);
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const boardId = (Deno.env.get('SUPPLIER_BOARD_ID') ?? OGEE_BOARD_ID).trim() || OGEE_BOARD_ID;

  try {
    let items = Array.isArray(body.items) ? body.items : null;
    let complete = body.complete === true;
    if (!items) {
      const token = Deno.env.get('MONDAY_API_TOKEN') ?? '';
      if (!token) return json({ error: 'monday_not_configured' }, 503);
      items = await readMonday(boardId, token);
      complete = true;
    }
    const drafts = groupJobs(parseBoardItems(items));
    const result = await applySync(supabase, organizationId, boardId, drafts, complete);
    return json({ ok: true, board_id: boardId, ...result });
  } catch (err) {
    const code = err instanceof Error ? err.message : 'sync_failed';
    console.error('supplier-sync', code);
    const status = code === 'monday_http' || code === 'monday_query' ? 502 : 500;
    return json({ error: code === 'monday_http' || code === 'monday_query' ? 'monday_read_failed' : 'sync_failed' }, status);
  }
});
