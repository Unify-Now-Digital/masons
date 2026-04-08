import { getUserFromRequest } from './auth.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

const FETCH_TIMEOUT_MS = 10_000;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function parseAdminEmails(): string[] {
  const raw = Deno.env.get('ADMIN_EMAILS') ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
}

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return parseAdminEmails().includes(e);
}

function isTimeoutError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  if (typeof e === 'object' && e !== null && 'name' in e && (e as { name: string }).name === 'TimeoutError') {
    return true;
  }
  return false;
}

function sentryApiBase(): string {
  const host = (Deno.env.get('SENTRY_HOST') ?? 'https://sentry.io').replace(/\/$/, '');
  return host;
}

async function sentryFetch(pathWithQuery: string, token: string): Promise<Response> {
  const url = new URL(pathWithQuery, sentryApiBase());
  return await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

/**
 * Sentry /stats/ returns [[unixTs, count], ...] for a single stat (see Sentry API docs).
 */
function parsePairSeries(data: unknown): { ts: number; value: number }[] {
  if (!Array.isArray(data)) return [];
  const out: { ts: number; value: number }[] = [];
  for (const row of data) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const ts = Number(row[0]);
    const value = Number(row[1]);
    if (!Number.isFinite(ts) || !Number.isFinite(value)) continue;
    out.push({ ts, value });
  }
  return out;
}

function sumInWindow(points: { ts: number; value: number }[], nowSec: number, windowSec: number): number {
  const cutoff = nowSec - windowSec;
  let sum = 0;
  for (const p of points) {
    if (p.ts >= cutoff) sum += p.value;
  }
  return sum;
}

async function handleIssues(
  org: string,
  project: string,
  token: string,
  limit: number,
): Promise<Response> {
  const path =
    `/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?limit=${limit}`;
  const resp = await sentryFetch(path, token);
  if (!resp.ok) {
    const txt = await resp.text();
    console.error('Sentry issues error', resp.status, txt.slice(0, 500));
    return jsonResponse({ error: 'Could not load issues from monitoring service.' }, 502);
  }
  const data = (await resp.json()) as Record<string, unknown>[];
  const rawList = Array.isArray(data) ? data : [];

  const issues = rawList.map((raw) => ({
    id: String(raw.id ?? ''),
    title: String(raw.title ?? raw.culprit ?? 'Unknown'),
    count: Number(raw.count ?? 0),
    firstSeen: String(raw.firstSeen ?? ''),
    lastSeen: String(raw.lastSeen ?? ''),
    level: raw.level != null ? String(raw.level) : undefined,
    permalink: raw.permalink != null ? String(raw.permalink) : undefined,
  }));

  return jsonResponse({ issues });
}

async function handleStats(org: string, project: string, token: string): Promise<Response> {
  const nowSec = Math.floor(Date.now() / 1000);
  const since30d = nowSec - 30 * 24 * 3600;
  const statsPath = (stat: string) =>
    `/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/stats/?stat=${stat}&resolution=1d&since=${since30d}&until=${nowSec}`;

  const receivedResp = await sentryFetch(statsPath('received'), token);
  if (!receivedResp.ok) {
    const txt = await receivedResp.text();
    console.error('Sentry stats (received) error', receivedResp.status, txt.slice(0, 500));
    return jsonResponse({ error: 'Could not load statistics from monitoring service.' }, 502);
  }

  const receivedJson = (await receivedResp.json()) as unknown;
  const receivedPoints = parsePairSeries(receivedJson);

  const errors24h = sumInWindow(receivedPoints, nowSec, 24 * 3600);
  const errors7d = sumInWindow(receivedPoints, nowSec, 7 * 24 * 3600);
  const errors30d = sumInWindow(receivedPoints, nowSec, 30 * 24 * 3600);

  let usersAffected = 0;
  try {
    const userResp = await sentryFetch(statsPath('user'), token);
    if (userResp.ok) {
      const userJson = (await userResp.json()) as unknown;
      const userPoints = parsePairSeries(userJson);
      usersAffected = sumInWindow(userPoints, nowSec, 30 * 24 * 3600);
    }
  } catch {
    /* optional metric — ignore */
  }

  const series = receivedPoints
    .map((p) => ({
      ts: new Date(p.ts * 1000).toISOString(),
      errors: p.value,
    }))
    .sort((a, b) => a.ts.localeCompare(b.ts));

  return jsonResponse({
    period: {
      errors24h,
      errors7d,
      errors30d,
      usersAffected,
    },
    series,
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user?.email) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    if (!isAdminEmail(user.email)) {
      return jsonResponse({ error: 'Forbidden' }, 403);
    }

    const token = Deno.env.get('SENTRY_AUTH_TOKEN') ?? '';
    const org = Deno.env.get('SENTRY_ORG_SLUG') ?? '';
    const project = Deno.env.get('SENTRY_PROJECT_SLUG') ?? '';
    if (!token || !org || !project) {
      return jsonResponse({ error: 'Monitoring is not configured.' }, 500);
    }

    const url = new URL(req.url);
    const op = url.searchParams.get('op');

    if (op === 'issues') {
      const limitRaw = url.searchParams.get('limit');
      let limit = limitRaw ? Number(limitRaw) : 25;
      if (!Number.isFinite(limit) || limit < 1) limit = 25;
      if (limit > 100) limit = 100;
      return await handleIssues(org, project, token, limit);
    }

    if (op === 'stats') {
      return await handleStats(org, project, token);
    }

    return jsonResponse({ error: 'Invalid or missing op parameter.' }, 400);
  } catch (e) {
    if (isTimeoutError(e)) {
      console.error('sentry-proxy: Sentry request timed out');
      return jsonResponse(
        { error: 'Monitoring service took too long to respond. Please try again in a moment.' },
        502,
      );
    }
    console.error('sentry-proxy:', e);
    return jsonResponse({ error: 'Something went wrong loading monitoring data.' }, 500);
  }
});
