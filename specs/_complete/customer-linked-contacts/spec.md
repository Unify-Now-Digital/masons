# Feature Specification: Customer Linked Contacts — Visibility and Proof-Send Resolution

**Feature Branch**: `fix/customer-linked-contacts`
**Created**: 2026-03-31
**Status**: Draft

---

## Context

When a staff member receives a message in the Inbox, they can link that conversation to a customer record. This creates a connection between the customer and the email address or phone number used in that conversation. These linked contacts are currently invisible everywhere outside the Inbox, and proof delivery incorrectly used the static primary fields on the customer record rather than the full set of available contacts. This feature makes linked contacts visible in the Customer detail view and allows staff to choose the correct contact when sending a proof.

---

## User Scenarios & Testing

### User Story 1 — Staff Sees All Linked Contacts in Customer Detail (Priority: P1)

A staff member opens the Customer detail view (edit drawer) for a customer. In addition to the existing static email and phone fields, they now see a clearly labelled "Linked Contacts" section listing every email address, phone number, and WhatsApp number that has been linked to this customer from the Inbox. This section is read-only — linking and unlinking still happens from the Inbox.

**Why this priority**: Staff must be able to verify what contact information is associated with a customer before sending. Without this, they cannot audit or trust the addresses being used for proof delivery.

**Independent Test**: Open the edit drawer for a customer who has at least one linked Inbox conversation. The "Linked Contacts" section must appear and show the correct addresses/numbers with their channel types.

**Acceptance Scenarios**:

1. **Given** a customer with two linked email conversations, **When** the edit drawer is opened, **Then** the "Linked Contacts" section shows two email entries with the address for each.
2. **Given** a customer with linked email, SMS, and WhatsApp conversations, **When** the edit drawer is opened, **Then** all three are shown with their respective channel label (Email / SMS / WhatsApp).
3. **Given** a customer with no linked conversations, **When** the edit drawer is opened, **Then** the "Linked Contacts" section shows an empty state message: "No linked contacts. Link addresses from the Inbox."
4. **Given** a customer has the same email address linked via two separate conversations, **When** the edit drawer is opened, **Then** that email address appears only once (deduplicated by channel + value).
5. **Given** the "Linked Contacts" section is visible, **When** a staff member attempts to edit an entry, **Then** no editing is possible — the section is read-only with no input fields or delete buttons.

---

### User Story 2 — Staff Selects the Correct Contact When Sending a Proof (Priority: P1)

When sending a proof to a customer from the Order view, the "Send Proof" modal now presents a contact picker for each channel. The picker combines linked Inbox contacts with the static customer email/phone, deduplicates, and lets staff choose the specific address to send to when multiple options exist.

**Why this priority**: This directly fixes the root cause of proof delivery going to the wrong address. The static fields on the customer record are often outdated or absent; the linked contacts reflect the actual communication history.

**Independent Test**: For a customer with two linked email addresses and no static email, open the Send Proof modal. Both linked emails must appear as selectable options. Select one, send, and confirm the proof is dispatched to the selected address only.

**Acceptance Scenarios**:

1. **Given** a customer has exactly one email contact (static or linked), **When** the Send Proof modal opens with Email selected, **Then** that address is pre-selected and the staff member can proceed without choosing.
2. **Given** a customer has two or more email contacts (from any source), **When** the Send Proof modal opens, **Then** a radio group shows all available email options; staff must choose one before sending.
3. **Given** a customer has no email contact of any kind, **When** the Send Proof modal opens, **Then** the Email channel checkbox is disabled with the tooltip "No email address on file for this customer".
4. **Given** a customer has exactly one WhatsApp or SMS contact (static or linked), **When** WhatsApp is selected, **Then** that number is pre-selected and sending proceeds without a choice.
5. **Given** a customer has two or more phone/WhatsApp contacts, **When** WhatsApp is selected, **Then** a radio group lists all available numbers; staff must choose before sending.
6. **Given** a customer has no phone/WhatsApp contact of any kind, **When** the Send Proof modal opens, **Then** the WhatsApp channel checkbox is disabled with the tooltip "No phone number on file for this customer".
7. **Given** the same email address appears in both the static customer record and a linked contact, **When** the modal opens, **Then** that address appears only once in the picker (deduplicated).

---

### Edge Cases

- What happens if a customer's linked conversation is later unlinked from the Inbox? The contact no longer appears in the "Linked Contacts" section on next open; if it was the only option for a channel, that channel becomes disabled in the Send Proof modal.
- What happens if the linked contacts query returns an error? The "Linked Contacts" section shows a loading error state; the Send Proof modal falls back to the static customer fields only and proceeds as before.
- What happens when multiple conversations share the same handle (e.g. the same WhatsApp number appears in three separate threads)? Deduplication by channel + handle means the number appears once in both the detail view and the picker.

---

## Requirements

### Functional Requirements

- **FR-001**: The Customer edit drawer MUST display a "Linked Contacts" section after the existing contact fields, listing all contacts derived from conversations linked to this customer via the Inbox.
- **FR-002**: Each entry in the "Linked Contacts" section MUST show the channel type (Email, SMS, or WhatsApp) and the contact value (email address or phone number).
- **FR-003**: The "Linked Contacts" section MUST be read-only — no editing, adding, or removing contacts from this view.
- **FR-004**: The "Linked Contacts" section MUST deduplicate entries by channel + value so the same address does not appear twice.
- **FR-005**: When no linked contacts exist for a customer, the section MUST show an empty state message directing staff to the Inbox to link addresses.
- **FR-006**: The Send Proof modal MUST accept a customer identifier rather than resolved email/phone strings, so it can independently fetch all available contacts for that customer.
- **FR-007**: For each channel in the Send Proof modal, the modal MUST present all available contacts (linked + static, deduplicated) as selectable options.
- **FR-008**: When exactly one contact option exists for a channel, it MUST be pre-selected automatically; the staff member does not need to make a choice.
- **FR-009**: When multiple contact options exist for a channel, the modal MUST display a radio group requiring staff to select one before the send action is enabled.
- **FR-010**: When zero contact options exist for a channel, the channel checkbox MUST be disabled with a tooltip explaining why.
- **FR-011**: The upstream components that open the Send Proof modal MUST be updated to pass the customer identifier instead of the resolved string values.
- **FR-012**: Existing static Email and Phone fields on the customer record MUST remain visible and editable — this feature does not change them.
- **FR-013**: Linking and unlinking conversations to customers MUST continue to happen exclusively from the Inbox — no changes to that flow.

### Architectural Constraints

- **AC-001 (Module boundaries)**: Linked contacts query MUST be introduced in `src/modules/customers/` or a dedicated shared hook; no cross-module deep imports.
- **AC-002 (No new tables)**: No new database tables or columns are required — linked contacts are derived from `inbox_conversations WHERE person_id = customer_id AND link_state = 'linked'`.
- **AC-003 (RLS)**: The linked contacts query inherits `inbox_conversations` RLS — only the authenticated user's own conversations are returned.
- **AC-004 (Additive)**: Changes to the Customer edit drawer and Send Proof modal are additive — existing fields and behaviour are preserved.

### Key Entities

- **LinkedContact** (derived, frontend-only): Represents one unique contact handle linked to a customer. Attributes: channel (email / sms / whatsapp), value (email address or phone number). Derived from `inbox_conversations` by filtering `person_id = customer_id AND link_state = 'linked'`, selecting distinct `(channel, primary_handle)`.
- **Customer** (existing): Gains a visible "Linked Contacts" section in its detail view; remains structurally unchanged.
- **Send Proof Modal** (existing): Gains a contact picker per channel; replaces direct `customerEmail`/`customerPhone` string props with a `customerId` lookup.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Staff can view all linked contacts for a customer without leaving the Customer edit drawer — zero additional navigation required.
- **SC-002**: In the Send Proof modal, staff can identify and select the correct address for proof delivery in under 30 seconds, including when multiple options exist.
- **SC-003**: Proof delivery is directed to the staff-selected address 100% of the time — zero silent fallbacks to wrong or missing addresses.
- **SC-004**: Duplicate contact values (same address appearing in both static fields and linked conversations) appear exactly once in every display — zero duplicate entries.
- **SC-005**: The Customer edit drawer continues to load and save correctly after this change — zero regressions in the existing edit flow.

---

## Assumptions

- Linked contacts are stored in `inbox_conversations` with `person_id` (FK to `customers.id`) and `link_state = 'linked'`. The contact value is `primary_handle` and the channel type is `channel` (`'email'` | `'sms'` | `'whatsapp'`). Codebase confirmed.
- The Customer detail UI is the `EditCustomerDrawer` component — there is no separate read-only detail page. The "Linked Contacts" section is added inside this drawer. Codebase confirmed.
- The Send Proof modal currently receives `customerEmail` and `customerPhone` as resolved strings. This will be replaced by a `customerId` prop (the `person_id` from the linked order's primary person). Codebase confirmed.
- The upstream component (`ProofPanel` / `OrderDetailsSidebar`) already has access to `order.person_id` (the primary customer ID for the order) — this will be passed as `customerId` to the modal. Codebase confirmed.
- No new database tables or migrations are required for this feature.
- Deduplication of contacts is done in the frontend by normalising `(channel, primary_handle.trim().toLowerCase())` — no server-side deduplication needed for MVP volumes.
- SMS and WhatsApp are both mapped to the "phone" channel in proof delivery — an SMS or WhatsApp linked contact may be offered for WhatsApp proof sending (with channel label shown so staff can identify the type).
