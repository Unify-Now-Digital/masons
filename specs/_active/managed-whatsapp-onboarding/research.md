# Research: Managed WhatsApp Onboarding UI/UX Modal

**Phase 0 — Architecture findings from codebase analysis**  
**Date**: 2026-03-30

---

## 1. What the Status Endpoint Returns (and Doesn't)

**Decision**: A separate direct Supabase query is needed to fetch business `meta` for pre-population.

**Rationale**: `whatsapp-managed-status` (`GET /functions/v1/whatsapp-managed-status`) returns:

```ts
{
  exists: boolean
  mode: 'managed'
  connection_id?: string
  status: string          // lifecycle state
  status_reason_code?: string
  status_reason_message?: string
  action_required?: boolean
  connected_requirements?: { has_account_sid, has_sender_sid, has_from_address, provider_ready }
  last_synced_at?: string
}
```

It does **not** return `meta`. The `meta` column (JSON) on `whatsapp_managed_connections` stores:
```json
{ "business_name": "...", "business_email": "...", "business_phone": "...", "meta_business_id": null }
```
This is written by `whatsapp-managed-submit-business` on every successful submit.

**Alternative considered**: Extend the status edge function to include `meta`. Rejected because the plan explicitly prohibits touching backend edge functions.

**Resolution**: Add `fetchManagedWhatsAppMeta()` — a direct Supabase client query:
```ts
supabase
  .from('whatsapp_managed_connections')
  .select('meta')
  .order('updated_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```
RLS (`user_id = (select auth.uid())`) ensures only own row is readable. No service role needed.

---

## 2. The 'draft' Status — API Virtual State vs DB State

**Decision**: Treat `'draft'` as equivalent to "no row exists" (`!exists`). Step derivation checks `!managedStatus?.exists` first.

**Rationale**: The status endpoint returns `{ exists: false, status: 'draft' }` when no managed row exists. `'draft'` is **not** a database value — it is a virtual API placeholder. Line 415 of `WhatsAppConnectionStatus` checks `managedStatus?.status === 'draft'` to detect this case, which is correct but fragile. The new step-derivation function will use `!managedStatus?.exists` as the primary condition and treat `'draft'` as an alias, eliminating the implicit coupling.

**Alternative considered**: Map 'draft' in the DB check constraint. Rejected — no DB changes allowed.

---

## 3. Soft Disconnect for Managed Connections

**Decision**: Direct Supabase client update from the frontend; no new edge function needed.

**Rationale**: `whatsapp_managed_connections` has an RLS update policy for `authenticated`:
```sql
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()))
```
Setting `state = 'disconnected'` involves no secrets, no provider calls, and no privileged data. The existing `disconnectWhatsApp()` for manual connections uses the same pattern (direct client update). Adding `disconnectManagedWhatsApp(connectionId)` follows the same approach.

**After disconnect**: `useManagedWhatsAppDisconnect` invalidates the `managedStatus` query. The modal — which derives its screen from `managedStatus` — will re-render to the Disconnected screen. Clicking "Start new onboarding" calls `managedStartMutation.mutate()`, which in `whatsapp-managed-start` resets the existing `disconnected` row to `collecting_business_info` (already handled by the backend).

---

## 4. Step Derivation: Pure Function vs Component State

**Decision**: `deriveModalStep(status)` — a pure function exported from `ManagedWhatsAppModal.tsx`.

**Rationale**: Deriving the active screen from server state (not local React state) guarantees the modal always reflects reality when opened. If a `currentStep` state variable were used, it would need to be synced with `managedStatus` on every open, creating potential for showing the wrong step if the sync timing is off (e.g., after a background poll updates the status).

**Alternative considered**: `useState<ModalStep>` initialised from `managedStatus` on open. Rejected — two sources of truth, risk of stale step rendering.

---

## 5. Form Pre-population and Validation

**Decision**: Use controlled inputs with local `useState`; initialise from `meta` query data when available. Use native HTML5 validation (`required`, `type="email"`) consistent with the existing `WhatsAppConnectionStatus` form pattern; Zod/React Hook Form is not needed for a 3-field form.

**Rationale**: The existing business details form in `WhatsAppConnectionStatus` uses plain `useState` + `<Input required>`. Introducing React Hook Form for a 3-field form adds dependency weight with no benefit. The `useManagedWhatsAppMeta` query is enabled only when `status === 'action_required'`, so it only fires when needed.

**Alternative considered**: React Hook Form + Zod schema. Rejected for this scope (3 fields, inline validation already working in pattern).

---

## 6. Polling Behaviour (Existing — No Changes Required)

`useManagedWhatsAppStatus` already polls at 10 s intervals for pending states:
```ts
refetchInterval: (query) => {
  const status = query.state.data?.status;
  if (!status) return 15000;
  return ['pending_provider_review', 'pending_meta_action', 'provisioning', 'action_required']
    .includes(status) ? 10000 : false;
},
```
When the provider-ready webhook fires and the status transitions to `connected`, the next poll will update `managedStatus`, the modal (if open) will re-derive its step to "Connected", and the dropdown dot will go green. No changes required.

---

## 7. What Is NOT Changing (Confirmed Stable)

| Area | Status |
|------|--------|
| All backend edge functions | Untouched |
| `whatsappConnections.api.ts` — all existing exports | Untouched (additive only) |
| `useWhatsAppConnection.ts` — all existing hooks | Untouched (additive only) |
| Manual WhatsApp connection flow | Untouched |
| `whatsapp_managed_connections` schema | Untouched |
| Four-criteria connected rule evaluation | Untouched (same inline logic in `WhatsAppConnectionStatus`) |
| `ChannelConnectionsCard` | Untouched |
| `useManagedWhatsAppStatus` polling | Untouched |
