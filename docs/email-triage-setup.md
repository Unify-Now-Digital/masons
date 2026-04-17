# Email Triage — Daily Setup

GitHub Actions workflow that runs every day at 08:00 UTC, reads the last 24 h of Gmail emails from Supabase (`gmail_emails`), asks Claude to rate sentiment + next action, matches each thread to a task in the **CM: Orders** ClickUp list, and posts a minimal comment tagging Aylin Yazici.

## One-time setup

Add four repository secrets at `https://github.com/unify-now-digital/masons/settings/secrets/actions`:

| Secret | Where to get it |
|---|---|
| `SUPABASE_URL` | Supabase dashboard → Project Settings → API → `URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → `service_role` secret |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/ → API Keys |
| `CLICKUP_TOKEN` | ClickUp → top-right avatar → Settings → Apps → **Generate** (personal API token starts with `pk_`) |

That's the only manual step. Once those exist, the schedule runs automatically.

## Optional overrides (repository variables)

Set at `Settings → Secrets and variables → Actions → Variables` (or pass per-run via `workflow_dispatch` inputs):

- `CLICKUP_LIST_ID` — defaults to `901207633256`
- `CLICKUP_ASSIGNEE_ID` — defaults to `87788641` (Aylin)
- `CLICKUP_ASSIGNEE_NAME` — defaults to `Aylin Yazici`
- `LOOKBACK_HOURS` — defaults to `24`

## Manual run

Actions tab → **Email Triage (Daily)** → **Run workflow**. Set `dry_run=true` to see what *would* be posted without actually commenting.

## How matching works

1. Query `gmail_emails` in Supabase for rows with `received_at >= now() - 24h`.
2. Drop self-sends (`info@churchillmemorials.com`), auto-replies, and senders without cemetery/burial keywords (unless `.gov.uk` or known trade domain).
3. Pull every open task in the CM: Orders list and pre-score each one against the email using: customer email exact match (+100), deceased name in body (+40), burial-ground name in body (+30), plot code (+50), sender surname in task name (+20). Top 8 candidates go to Claude.
4. Claude returns `{sentiment, next_action, match_task_id, match_confidence, match_reason}`. Only `high` or `medium` confidence matches trigger a comment.
5. Comment format (minimal, per request):
   ```
   NEXT ACTION: …
   WHY: …

   From: … | YYYY-MM-DD | Subject: …
   Sentiment: …
   @Aylin Yazici — automated triage, please review.
   ```

## Safety notes

- The ClickUp service-role key gives full workspace write access. Rotate if leaked.
- The Supabase service-role key bypasses RLS. The script only reads `gmail_emails`; don't broaden its scope.
- The workflow has a 10-minute timeout. If the CM: Orders list grows past ~1000 tasks, increase `scripts/triage-emails.mjs` pagination loop.
- DRY_RUN=true is the safe way to test prompt/model changes without spamming ClickUp.

## Local testing

```bash
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… ANTHROPIC_API_KEY=… CLICKUP_TOKEN=… \
  DRY_RUN=true node scripts/triage-emails.mjs
```
