# Contract: frontend changes (assisted create, stamping, Change-link)

Behavioral contracts for the UI work — each is verifiable in isolation. Line numbers are
14 Aug 2026 anchors; re-grep before editing.

## C1 — createCustomer stamping (FR-A2)

`src/modules/customers/hooks/useCustomers.ts`

- `CustomerInsert` gains optional `created_via?: 'inbox_assisted' | 'manual'`.
- `createCustomer`/`useCreateCustomer` bodies unchanged (payload already spreads through).
- Call sites (exhaustive, from R3 audit):
  | Caller | Stamps |
  |---|---|
  | `inbox/components/AddToCustomersDialog.tsx:154` (`createCustomer(toCustomerInsert(values), …)`) | `created_via: 'inbox_assisted'` |
  | `customers/components/CreateCustomerDrawer.tsx:55` | `created_via: 'manual'` |
  | `invoicing/components/QuickCreatePersonDialog.tsx` (its createCustomer call) | `created_via: 'manual'` |
- Postconditions: a person saved from the inbox dialog reads back
  `created_via='inbox_assisted'`; from People page / invoicing quick-create → `'manual'`;
  updates (`CustomerUpdate`) never send the field.

## C2 — resolvePersonId stamping (FR-B2)

`src/modules/jobsPipeline/api/addToPipeline.api.ts:68–:79` — insert object gains
`created_via: 'manual'`, `is_test: false`. Match-first behavior unchanged (only the
create branch is touched).

## C3 — Assisted create is the primary action on unlinked threads (FR-A1/A3/A4/A5)

**Grouped view** — `src/modules/inbox/components/CustomerConversationView.tsx`:
- Unlinked selection: `actionButtonLabel = 'Add to Customers'`, onClick opens
  AddToCustomersDialog; `secondaryActionButtonLabel = 'Link person'`, onClick opens
  LinkConversationModal. Linked selection: primary stays `'Change link'`, no secondary
  (spec scenario 5).
- Dialog receives ALL of the group's conversation ids (`bulkConversationIds` — already the
  case at :282) so a save links every unlinked conversation of the handle (FR-A3).
- Muted/hidden selections render the same actions (no gating on mute state — FR-A5); saving
  never writes `inbox_muted_senders`.

**Ungrouped view** — `src/modules/inbox/components/ConversationView.tsx`:
- New: AddToCustomersDialog wired with
  `prefill = channel === 'email' ? { email: handle.toLowerCase().trim() } : { phone: handle }`,
  `conversationIds = [conversation.id]`.
- Not-linked (`link_state !== 'linked'`, incl. ambiguous — R4 decision):
  `actionButtonLabel = 'Add to Customers'` (opens dialog),
  `secondaryActionButtonLabel = 'Link person'` (opens link modal). Linked: `'Change link'`
  primary, as today.
- Its LinkConversationModal gains `onCreateNew` → closes modal, opens dialog (parity with
  grouped view, :264–:271 there).

Postconditions (spec US1 independent test): after save, person row has
`created_via='inbox_assisted'`; every passed conversation id has `person_id` set and
`link_state='linked'` in the same UPDATE (FR-1 CHECK satisfied); thread renders linked in both
views; mute state unchanged.

## C4 — Change-link fix (FR-D1)

`src/modules/inbox/components/CustomerConversationView.tsx:334–:336` — delete the
`if (!canLink) return;` early-return in `onActionClick`. Everything else stays: the click sets
`linkModalOpen`, which enables the linked-branch candidate query (:134–:137), and the modal's
`open={linkModalOpen && canLink}` (:253) opens it when ids arrive.

Postcondition (spec US3): from CustomerConversationView, first click on Change-link opens the
modal, candidates load, a relink completes and the view updates. Accepted residual (R2):
linked person with zero open conversations still no-ops.

## C5 — Stale comment + toast correction (FR-E1 + R8 flag)

`src/modules/inbox/components/PersonOrdersPanel.tsx:128–:130` — comment rewritten to state the
truth: 23505 here now means a **same-org** duplicate under `people_org_email_key`
(`(organization_id, lower(email))`, migration `20260802220000`); the global `people_email_key`
no longer exists. The adjacent toast string (:133–:141, "exists in another organization —
known limitation…") is reworded to match (flagged task — one string, user-visible falsehood).

## C6 — created_via CHECK migration (FR-B1, AC-004)

New file `supabase/migrations/<timestamp>_people_created_via_check.sql` (shape in
data-model.md). Applied by Giorgi via Dashboard SQL editor only; file carries the
precondition query + actual output and the `convalidated: true` read-back at apply time.
Rejects any non-NULL value outside `('inbox_ingest','inbox_assisted','manual')`; NULL legal.
