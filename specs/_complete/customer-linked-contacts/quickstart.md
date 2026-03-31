# Quickstart: Verify Customer Linked Contacts

Run `npm run dev` before starting. No migrations required.

---

## Scenario 1 — Linked Contacts visible in Customer edit drawer

**Setup**: Ensure at least one customer has a linked Inbox conversation (`inbox_conversations.person_id = customer.id AND link_state = 'linked'`). You can verify in Supabase Table Editor.

1. Open the People / Customers page.
2. Click the edit (pencil) icon on a customer who has linked conversations.
3. **Expected**: A "Linked Contacts" section appears below the existing form fields, before the Save button.
4. **Expected**: Each linked contact shows a channel badge (Email / SMS / WhatsApp) and the handle value.
5. **Expected**: The section is read-only — no edit, delete, or add controls.
6. Scroll to the static Email and Phone fields above.
7. **Expected**: Static Email and Phone fields are unchanged and still editable.

---

## Scenario 2 — Empty linked contacts state

**Setup**: Open edit drawer for a customer with NO linked conversations.

1. **Expected**: The "Linked Contacts" section shows: "No linked contacts. Link addresses from the Inbox."

---

## Scenario 3 — Proof send modal with single email option

**Setup**: An order linked to a customer who has exactly one email (either static or linked).

1. Open the Order in the sidebar.
2. Generate a proof (or have a draft proof).
3. Click "Send to Customer".
4. **Expected**: Email checkbox is pre-checked and the single email address is shown inline.
5. Send. **Expected**: Proof is sent to that address.

---

## Scenario 4 — Proof send modal with multiple email options

**Setup**: Customer has a static email AND at least one linked email conversation (different address).

1. Open Send Proof modal.
2. **Expected**: Email checkbox is enabled. When checked, a radio group appears showing both email options.
3. Select one radio option. Click Send Proof.
4. **Expected**: Proof is sent only to the selected address.

---

## Scenario 5 — Proof send modal with zero email options

**Setup**: Customer has no static email AND no linked email conversations.

1. Open Send Proof modal.
2. **Expected**: Email checkbox is disabled with tooltip "No email address on file for this customer".

---

## Scenario 6 — Deduplication

**Setup**: Customer has the same email address in both the static field AND a linked conversation.

1. Open Send Proof modal.
2. **Expected**: That email appears exactly ONCE in the options (not duplicated).

---

## Scenario 7 — OrderDetailsSidebar cleanup (no regressions)

1. Open any Order in the sidebar.
2. **Expected**: The ProofPanel still renders correctly.
3. Open browser Network tab. Confirm there is NO extra request to `order_people` when opening the sidebar (the `useOrderPeople` call was removed).
4. **Expected**: Proof generation, sending, approval still work end-to-end.
