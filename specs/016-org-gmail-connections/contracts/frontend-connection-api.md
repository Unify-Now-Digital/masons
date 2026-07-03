# Contract: Frontend connection API + org-settings surface

Files: `src/modules/inbox/api/gmailConnections.api.ts` and the org-settings host component.

## `fetchActiveGmailConnection` — fetch the ORG's connection

**Current**: `.eq('user_id', session.user.id).eq('status','active')` → the user's connection.
**Required**: fetch the current org's active connection.
- Drop the `user_id` filter; scope by the current org:
  `.eq('organization_id', orgId).eq('status','active')` (orgId from `OrganizationContext`), relying
  on org-scoped RLS for read authorization.
- To also drive the "reconnect required" indicator, return `status` and (optionally) fetch the org's
  latest connection even when `revoked` (e.g. drop the `status='active'` filter and take the most
  recent row, exposing `email_address` + `status`). **VERIFY** RLS allows the read for all members.
- Return shape adds `status` (already present) + `email_address` for display.

## Disconnect — admin-gated (decision flag)

**Current**: `disconnectGmail()` direct client `update … set status='revoked'` on the active row
(RLS-scoped to org membership) — any member can call it; no server-side admin gate.

**Recommended**: add a small `gmail-disconnect` edge function (POST, JWT) that runs the same
`organization_members role='admin'` check and sets the org's active row to `revoked`; frontend calls
it via `supabase.functions.invoke`. Aligns with the connect gate and the constitution ("UI checks are
not security").
**Alternative** (if the user prefers minimal surface): keep the direct client update, accept
member-level disconnect, gate the button cosmetically on `isOrgAdmin`. Document the weaker guarantee.
→ **Open Question 1 in research.md.**

## `getGmailOAuthUrl` — unchanged surface

Still calls `gmail-oauth-start`; the admin gate is added **server-side** (see gmail-oauth-connect
contract). On 403 the UI should show "Admin access required to connect Gmail".

## Org-settings surface

- Move the connect/disconnect status component into the org-settings host, visible to admins
  (`isOrgAdmin` from `OrganizationContext`). UI gating is cosmetic (**FR-011**).
- Show: connected mailbox `email_address`; a **"reconnect required"** indicator when the org
  connection `status='revoked'` (or no active row) (**FR-017**); Connect (admin) / Disconnect (admin).

## Acceptance

- Settings shows the **org's** mailbox regardless of which member connected it (**FR-008/011**).
- Revoked connection renders "reconnect required" (**FR-017**).
- No `.eq('user_id', …)` filter exists on `inbox_conversations`/`inbox_messages` queries; every org
  member sees the org's email threads (**FR-018**, US1 scenario 1, **SC-004**).
