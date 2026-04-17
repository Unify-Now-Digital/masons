#!/usr/bin/env node
// Daily email triage: Supabase gmail_emails → Claude (sentiment + match) → ClickUp comment.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, CLICKUP_TOKEN.
// Optional: CLICKUP_LIST_ID (default 901207633256), CLICKUP_ASSIGNEE_ID (default 87788641),
//           CLICKUP_ASSIGNEE_NAME (default "Aylin Yazici"), LOOKBACK_HOURS (default 24),
//           CHURCHILL_FROM (default info@churchillmemorials.com), DRY_RUN (default false).

const env = (k, d) => process.env[k] ?? d;
const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ANTHROPIC_API_KEY", "CLICKUP_TOKEN"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY");
const CLICKUP_TOKEN = env("CLICKUP_TOKEN");
const CLICKUP_LIST_ID = env("CLICKUP_LIST_ID", "901207633256");
const CLICKUP_ASSIGNEE_ID = Number(env("CLICKUP_ASSIGNEE_ID", "87788641"));
const CLICKUP_ASSIGNEE_NAME = env("CLICKUP_ASSIGNEE_NAME", "Aylin Yazici");
const LOOKBACK_HOURS = Number(env("LOOKBACK_HOURS", "24"));
const CHURCHILL_FROM = env("CHURCHILL_FROM", "info@churchillmemorials.com");
const DRY_RUN = env("DRY_RUN", "false") === "true";
const MODEL = env("ANTHROPIC_MODEL", "claude-haiku-4-5");

const KEYWORDS = /cemetery|churchyard|parish(es)?|burial|graveyard|interment|memorial|headstone|grave\b|plot\b/i;
const EXCLUDE_SENDERS = /no-?reply|donotreply|do-not-reply|mailer-daemon|postmaster|ebay\.co|newsletter|marketing/i;
const TRADE_DOMAINS = /@(ginder\.co\.uk|wcpltd\.com|bakersofdanbury\.co\.uk|dignityfunerals\.co\.uk|coop(funeralcare)?\.co\.uk)$/i;

async function supabase(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function clickup(path, opts = {}) {
  const r = await fetch(`https://api.clickup.com/api/v2/${path}`, {
    ...opts,
    headers: { Authorization: CLICKUP_TOKEN, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error(`ClickUp ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function claude(system, user) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic: ${r.status} ${await r.text()}`);
  const data = await r.json();
  return data.content?.[0]?.text ?? "";
}

function isRelevant(e) {
  const from = (e.from_email || "").toLowerCase();
  if (!from || from.includes(CHURCHILL_FROM.toLowerCase())) return false;
  if (EXCLUDE_SENDERS.test(from)) return false;
  const blob = `${e.subject || ""} ${e.content_text || ""}`;
  if (KEYWORDS.test(blob)) return true;
  if (from.endsWith(".gov.uk")) return true;
  if (TRADE_DOMAINS.test(from)) return true;
  return false;
}

async function fetchRecentEmails() {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();
  const qs = new URLSearchParams({
    select: "id,thread_id,message_id,subject,from_email,from_name,to_email,content_text,received_at",
    received_at: `gte.${since}`,
    order: "received_at.desc",
    limit: "500",
  });
  return supabase(`gmail_emails?${qs}`);
}

function groupByThread(emails) {
  const m = new Map();
  for (const e of emails) {
    const arr = m.get(e.thread_id) || [];
    arr.push(e);
    m.set(e.thread_id, arr);
  }
  for (const arr of m.values()) arr.sort((a, b) => new Date(a.received_at) - new Date(b.received_at));
  return m;
}

async function fetchListTasks() {
  const tasks = [];
  for (let page = 0; page < 10; page++) {
    const data = await clickup(
      `list/${CLICKUP_LIST_ID}/task?archived=false&include_closed=false&subtasks=true&page=${page}&custom_fields=${encodeURIComponent(JSON.stringify([]))}`,
    );
    if (!data.tasks?.length) break;
    tasks.push(...data.tasks);
    if (data.tasks.length < 100) break;
  }
  return tasks;
}

function compactTaskForPrompt(t) {
  const f = Object.fromEntries((t.custom_fields || []).map((c) => [c.name, c.value]));
  return {
    id: t.id,
    name: t.name,
    status: t.status?.status,
    burial_ground: f["Burial Ground"],
    deceased: f["N. of Deceased"],
    customer_email: f["Email (Customer)"],
    plot: f["Plot"],
    address: f["Address"]?.formatted_address,
  };
}

const MATCH_SYSTEM = `You triage incoming emails for Churchill Memorials (a memorial mason).
For one email thread + a list of candidate ClickUp orders, return strict JSON:
{"sentiment":"positive|neutral|negative|urgent","next_action":"...","match_task_id":"<id or null>","match_confidence":"high|medium|low|none","match_reason":"short explanation of the match (deceased name, customer email, cemetery, plot)"}
Match conservatively. Prefer exact matches on customer email, or deceased surname + burial ground. If two signals disagree (e.g. cemetery mismatch), set match to null. Keep next_action to one short sentence.`;

function buildUserPrompt(thread, candidates) {
  const last = thread[thread.length - 1];
  const body = (last.content_text || "").slice(0, 4000);
  return `EMAIL THREAD (${thread.length} msg):
From: ${last.from_name || ""} <${last.from_email}>
Date: ${last.received_at}
Subject: ${last.subject}

${body}

CANDIDATE ORDERS (JSON):
${JSON.stringify(candidates, null, 2)}

Return the JSON object only.`;
}

function prefilterCandidates(thread, tasks) {
  const last = thread[thread.length - 1];
  const fromEmail = (last.from_email || "").toLowerCase();
  const blob = `${last.subject || ""} ${last.content_text || ""}`.toLowerCase();
  const scored = [];
  for (const t of tasks) {
    const c = compactTaskForPrompt(t);
    let score = 0;
    if (c.customer_email && c.customer_email.toLowerCase() === fromEmail) score += 100;
    const lastName = (last.from_name || "").split(" ").pop()?.toLowerCase();
    if (lastName && c.name && c.name.toLowerCase().includes(lastName)) score += 20;
    if (c.deceased && c.deceased.toLowerCase() !== "tbc") {
      const dec = c.deceased.toLowerCase();
      if (blob.includes(dec)) score += 40;
      const decLast = dec.split(" ").pop();
      if (decLast && decLast.length > 3 && blob.includes(decLast)) score += 20;
    }
    if (c.burial_ground) {
      const bg = c.burial_ground.toLowerCase();
      if (blob.includes(bg)) score += 30;
      const bgWords = bg.split(/\s+/).filter((w) => w.length > 4);
      for (const w of bgWords) if (blob.includes(w)) score += 5;
    }
    if (c.plot && blob.includes(c.plot.toLowerCase())) score += 50;
    if (score > 0) scored.push({ score, candidate: c });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8).map((x) => x.candidate);
}

function commentTemplate({ nextAction, reason, from, date, subject, sentiment }) {
  return `NEXT ACTION: ${nextAction}
WHY: ${reason}

From: ${from} | ${date.slice(0, 10)} | Subject: ${subject}
Sentiment: ${sentiment}
@${CLICKUP_ASSIGNEE_NAME} — automated triage, please review.`;
}

async function postComment(taskId, text) {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] Would comment on ${taskId}:\n${text}\n`);
    return { id: "dry-run" };
  }
  return clickup(`task/${taskId}/comment`, {
    method: "POST",
    body: JSON.stringify({ comment_text: text, assignee: CLICKUP_ASSIGNEE_ID, notify_all: true }),
  });
}

async function main() {
  console.log(`[triage] lookback=${LOOKBACK_HOURS}h dry_run=${DRY_RUN}`);
  const emails = await fetchRecentEmails();
  console.log(`[triage] fetched ${emails.length} emails from supabase`);
  const threads = groupByThread(emails.filter(isRelevant));
  console.log(`[triage] ${threads.size} relevant threads after filtering`);

  const tasks = await fetchListTasks();
  console.log(`[triage] loaded ${tasks.length} CM: Orders tasks`);

  const matched = [];
  const unmatched = [];
  for (const [threadId, msgs] of threads) {
    const last = msgs[msgs.length - 1];
    const candidates = prefilterCandidates(msgs, tasks);
    let result;
    try {
      const raw = await claude(MATCH_SYSTEM, buildUserPrompt(msgs, candidates));
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0];
      result = JSON.parse(jsonStr);
    } catch (err) {
      console.error(`[triage] thread ${threadId} claude/parse error:`, err.message);
      unmatched.push({ threadId, from: last.from_email, subject: last.subject, reason: "claude_error" });
      continue;
    }
    const confidence = result.match_confidence || "none";
    if (result.match_task_id && confidence !== "none" && confidence !== "low") {
      const text = commentTemplate({
        nextAction: result.next_action,
        reason: result.match_reason,
        from: last.from_email,
        date: last.received_at,
        subject: last.subject || "(no subject)",
        sentiment: result.sentiment,
      });
      try {
        const c = await postComment(result.match_task_id, text);
        console.log(`[triage] commented task=${result.match_task_id} id=${c.id}`);
        matched.push({ threadId, taskId: result.match_task_id, commentId: c.id, subject: last.subject });
      } catch (err) {
        console.error(`[triage] failed to comment on ${result.match_task_id}:`, err.message);
        unmatched.push({ threadId, from: last.from_email, subject: last.subject, reason: "comment_error" });
      }
    } else {
      unmatched.push({
        threadId,
        from: last.from_email,
        subject: last.subject,
        sentiment: result.sentiment,
        next_action: result.next_action,
        reason: `no_match (${confidence})`,
      });
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Matched & commented: ${matched.length}`);
  for (const m of matched) console.log(`  ✓ ${m.taskId} — ${m.subject}`);
  console.log(`\nUnmatched: ${unmatched.length}`);
  for (const u of unmatched) console.log(`  • ${u.from} — ${u.subject} [${u.reason}]`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
