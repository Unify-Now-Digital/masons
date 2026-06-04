# Feature Specification: Per-Organization Stripe Payments (Tenant Isolation)

**Feature Branch**: `012-per-org-stripe`  
**Created**: 2026-06-04  
**Status**: Draft  
**Input**: User description: "Make the existing Stripe payment integration per-organization, so each client organization takes payments through its own independent Stripe account, fully isolated from every other organization."

## Clarifications

### Session 2026-06-04

- Q: How should test and live Stripe credentials coexist per organisation over the go-live lifecycle? → A: **Dual sets** — parallel test and live credential triplets (secret, publishable, webhook signing secret). **Outbound** API/publishable resolution uses test vs live per `live_payments_enabled`; **inbound** webhooks and reconciliation follow FR-001a rules (b) and (c), not a single live on/off switch.
- Q: When live payments are disabled mid-checkout, what happens to in-flight sessions? → A: **Freeze in-flight** — checkout sessions created before disable may complete and reconcile using the live credential context active at creation; new live payment initiation is blocked immediately.
- Q: Who may register/rotate Stripe credentials and toggle live payments in v1? → A: **Platform implementation operators only** — organisation members cannot register credentials or enable/disable live payments.
- Q: What gate is required before enabling live payments for the test-mode round trip? → A: **Hard block only** — live enablement remains disabled until the system automatically records a successful test-mode round trip (payment completed, webhook verified, Mason invoice reconciled as paid).
- Q: Which rule determines when Mason marks an invoice paid? → A: **Path-specific authority** — checkout path uses `checkout.session.completed` (and its payment intent); hosted-invoice path uses `invoice.paid`; no other subscribed handler may set Mason paid alone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every payment uses the owning organisation's account (Priority: P1)

As an organisation using Mason, when my customers pay an invoice or complete checkout, the money and payment record are processed only through **my** organisation's own Stripe account — never through another workshop's account.

**Why this priority**: Today a single shared Stripe account would mis-route real customer payments across tenants. Tenant-isolated payment routing is the non-negotiable safety requirement for multi-organisation launch.

**Independent Test**: Can be fully tested by creating and paying an invoice for organisation A and organisation B in the same environment, then confirming each payment appears only in that organisation's Stripe dashboard and Mason reconciles each invoice against the correct organisation.

**Acceptance Scenarios**:

1. **Given** organisation A and organisation B each have their own registered Stripe credentials, **When** a customer pays an invoice owned by organisation A, **Then** the charge is created in organisation A's Stripe account only and Mason records the payment against organisation A's invoice.
2. **Given** the same setup, **When** a customer pays an invoice owned by organisation B, **Then** the charge is created in organisation B's Stripe account only and never touches organisation A's account.
3. **Given** I am staff acting on an invoice, **When** Mason creates checkout, sends or revises a Stripe invoice, fetches payment status, or reconciles payment, **Then** every such action uses the credentials of the organisation that owns that invoice (as already recorded on the invoice), not a global default.
4. **Given** a customer opens the hosted checkout or payment experience for an invoice, **When** the payment UI loads, **Then** it uses the publishable key belonging to the invoice's owning organisation only.

---

### User Story 2 - Operator registers credentials once per organisation (Priority: P1)

As a **platform implementation operator** onboarding a workshop for payments, I can register that organisation's Stripe credentials (secret key, publishable key, and webhook signing secret) once; after that, all checkout, invoicing, and payment-reconciliation activity for that organisation uses those credentials automatically without per-action setup. Organisation administrators and staff cannot register or rotate payment credentials in v1.

**Why this priority**: Operators already onboard organisations for other integrations; payment setup must follow the same predictable, auditable pattern before any organisation can take money.

**Independent Test**: Can be fully tested by registering test credentials for a pilot organisation, performing one invoice lifecycle action, and confirming no further credential entry is required for subsequent checkout, invoice send, or webhook processing for that organisation.

**Acceptance Scenarios**:

1. **Given** I am a platform implementation operator, **When** I register an organisation's test and live Stripe credential sets (secret key, publishable key, and webhook signing secret per set), **Then** both sets are stored for that organisation only and are not visible in the browser, customer-facing pages, or routine operational logs.
2. **Given** credentials are registered for organisation A, **When** any payment operation runs for an invoice owned by organisation A, **Then** the system resolves organisation A's stored credentials without manual selection at payment time.
3. **Given** an organisation has no registered Stripe credentials, **When** staff attempt payment-related actions for that organisation's invoices, **Then** the action is blocked with a clear message that payment is not configured for this workshop (rather than falling back to another organisation's account).
4. **Given** live secret keys are stored, **When** credentials are persisted, **Then** they are protected with the same class of at-rest encryption used for other per-organisation integration secrets in Mason (operator-managed, not self-service by the workshop in v1).

---

### User Story 3 - Verified test round trip before live money (Priority: P1)

As an operator or developer validating readiness, I can run a full payment round trip for a specific organisation in Stripe test mode — create invoice or checkout, complete payment, receive webhook, see Mason invoice reconciled as paid — before that organisation is enabled for live payments.

**Why this priority**: Live enablement affects real money with no automatic reversal; test-mode verification is the deliberate gate before any organisation (starting with Churchill) goes live.

**Independent Test**: Can be fully tested end-to-end in test mode for one organisation without enabling any other organisation, documenting each step from invoice creation through paid reconciliation.

**Acceptance Scenarios**:

1. **Given** an organisation has test-mode Stripe credentials registered and live payments are **not** enabled for that organisation, **When** I complete a test checkout or invoice payment and the provider sends a webhook, **Then** Mason verifies the webhook with that organisation's signing secret, updates reconciliation, and marks the Mason invoice paid consistently with the provider's paid status.
2. **Given** the system has not recorded a successful test-mode round trip for an organisation, **When** a platform operator attempts to enable live payments for that organisation, **Then** enablement is blocked and the operator sees which test steps are outstanding.
3. **Given** the system has recorded a successful test-mode round trip (test payment, webhook verified, Mason invoice paid in test mode), **When** a platform operator enables live payments, **Then** live enablement is permitted (subject to live credential set being present and valid).
4. **Given** live payments are enabled for an organisation, **When** live customer payments occur, **Then** only that organisation processes live charges; all other organisations remain on their prior configuration (disabled or test-only).
5. **Given** I am validating Churchill as the first live target, **When** Churchill is enabled for live payments after its recorded test round trip, **Then** no other organisation's live-payment setting changes unless explicitly configured for that organisation.

---

### User Story 4 - Progressive per-organisation live enablement and quick disable (Priority: P2)

As a **platform implementation operator**, I can turn live payment capability on or off for one organisation at a time (default off), so a pilot such as Churchill can take real payments while others stay disabled, and I can stop live processing quickly if something looks wrong — without affecting other organisations and without waiting for a software release. Workshop org admins and staff cannot toggle live payments in v1.

**Why this priority**: Reduces blast radius during rollout and supports operational safety when handling bereaved families' payments.

**Independent Test**: Can be fully tested by toggling live enablement for organisation A only and confirming organisation B cannot process live charges and that disabling organisation A stops new live payment initiation promptly.

**Acceptance Scenarios**:

1. **Given** a newly registered organisation, **When** no operator has enabled live payments, **Then** that organisation defaults to not enabled for live payments (test credentials may still be used for verification).
2. **Given** live payments are enabled for organisation A, **When** an operator disables live payments for organisation A, **Then** new live payment initiation for organisation A stops immediately while other organisations' settings are unchanged.
3. **Given** a customer already has an open live checkout session created before live was disabled, **When** the customer completes payment and Stripe sends a webhook, **Then** Mason reconciles the payment using the live credential context from session creation and does not block reconciliation solely because live is now disabled.
4. **Given** live payments have been disabled for organisation A, **When** staff attempt to start a new live checkout or live hosted-invoice payment for organisation A, **Then** the action is blocked with a clear message that live payments are off for this workshop.
5. **Given** live payments are disabled for an organisation mid-incident, **When** staff view payment status, **Then** they see a clear indication that live processing is off for this workshop (new live payments blocked; in-flight sessions may still complete) and should not expect new live charges until re-enabled.

---

### User Story 5 - Consistent paid state across Mason and Stripe (Priority: P1)

As staff relying on invoice status, I see a single trustworthy paid/unpaid state: Mason's invoice status and the payment provider's status for that invoice must not contradict each other after checkout, hosted invoice payment, or webhook reconciliation.

**Why this priority**: A known defect allows Mason to show paid while Stripe still shows the full amount outstanding — undermining trust and risking duplicate collection or missed follow-up.

**Independent Test**: Can be fully tested by exercising both payment paths (checkout session flow and hosted Stripe invoice flow) on test invoices and asserting paid state matches the provider after each path and after webhook delivery.

**Acceptance Scenarios**:

1. **Given** a customer completes payment via the **checkout session** path, **When** Mason processes a verified `checkout.session.completed` webhook for that session, **Then** Mason marks the invoice paid only if the session and linked payment intent confirm successful payment for the full expected amount (per existing business rules for full payment).
2. **Given** a customer pays via the **hosted Stripe invoice** path, **When** Mason processes a verified `invoice.paid` webhook for that Stripe invoice, **Then** Mason marks the invoice paid; Mason does not mark paid from checkout-session events on this path.
3. **Given** a payment event such as `payment_intent.succeeded` is received without the authoritative event for that path, **When** Mason processes the webhook, **Then** Mason does not set the invoice paid solely from that event (it may update ancillary payment metadata only).
4. **Given** webhook handlers exist for payment events, **When** the system receives events the organisation's Stripe account is actually subscribed to, **Then** only path-authoritative subscribed event types drive paid-state updates; handlers for unsubscribed or non-authoritative event types are removed or aligned so dead code cannot imply false reconciliation.
5. **Given** a prior contradictory state existed, **When** this capability ships, **Then** new payments cannot enter a state where Mason is paid and the provider shows full amount outstanding without an explicit, auditable exception flag (if any exception is ever allowed).

---

### User Story 6 - Organisation-scoped inbound webhooks (Priority: P1)

As an operator configuring Stripe for a workshop, I register a dedicated webhook endpoint URL for that organisation so Mason can identify which organisation's signing secret to use **before** trusting the event body, then verify and process the event only for that organisation.

**Why this priority**: Each Stripe account signs webhooks with its own secret; verifying against the wrong secret would either reject valid events or risk processing forged payloads.

**Independent Test**: Can be fully tested by sending test webhooks to organisation-specific endpoint URLs with correct and incorrect signing secrets and confirming only valid, org-matched events update Mason data.

**Acceptance Scenarios**:

1. **Given** organisation A's webhook URL includes an organisation identifier outside the signed payload, **When** Stripe delivers an event to that URL, **Then** Mason selects organisation A's webhook signing secret to verify the payload before any business action.
2. **Given** a webhook arrives with a valid signature for organisation A, **When** the event references an invoice or payment belonging to organisation A, **Then** reconciliation proceeds; if the referenced Mason invoice belongs to another organisation, **Then** the event is rejected and logged for investigation (no cross-tenant update).
3. **Given** a webhook fails signature verification, **When** Mason receives it, **Then** no invoice or payment state changes and the failure is auditable.
4. **Given** each organisation configures its own webhook URL in its own Stripe dashboard, **When** events are delivered, **Then** organisations never share one webhook signing secret.

---

### Edge Cases

- What happens when an invoice has no `organization_id` or it does not match stored credentials? Payment actions must fail safely with an operator-visible error; no fallback to a global or another organisation's account.
- What happens when an organisation has publishable key but secret key is missing or invalid? Customer-facing checkout must not load with a broken key; staff see configuration incomplete.
- What happens when live payments are enabled but the live credential set contains test-mode keys (or vice versa)? The system MUST reject payment initiation and surface a clear mode mismatch; operators must correct the affected credential set without overwriting the other set.
- What happens when two payment flows (checkout vs hosted invoice) both attempt to mark paid? Each invoice payment path has one authoritative webhook event (`checkout.session.completed` vs `invoice.paid`); non-authoritative events (e.g. `payment_intent.succeeded` alone) must not set Mason paid.
- What happens when a webhook is replayed? Idempotent reconciliation must not duplicate payment records or flip paid state incorrectly.
- What happens when organisation B's webhook URL is mistakenly configured in organisation A's Stripe dashboard? Signature verification fails or org-invoice mismatch rejects the event — no silent cross-tenant update.
- What happens when live payments are disabled mid-checkout? **New** live checkout or hosted-invoice payment initiation is blocked immediately. Checkout sessions already open before disable may complete at Stripe; Mason reconciles successful payments using the live credential context bound at session creation (not the test set switched on by the disable flag).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST store, per organisation, **two independent credential sets** (test and live), each comprising a Stripe secret key, publishable key, and webhook signing secret; credential sets MUST NOT be shared across organisations.
- **FR-001a**: Credential selection is governed by **three independent rules**, which MUST NOT be collapsed into a single live on/off switch:
  - **(a) Outbound charge initiation** — whether a **new** live charge may be created — is governed by the org's `live_payments_enabled` flag. When live is disabled, no new live charges are initiated (test credentials used for new outbound operations).
  - **(b) Inbound webhook signature verification** — which webhook secret verifies an incoming event — is governed by the event's own mode (`livemode`), via dual-secret verification (try the applicable test/live `whsec`), **not** by the org's current `live_payments_enabled` flag. A live-mode in-flight event MUST still verify against the live webhook secret even after live is disabled.
  - **(c) Reconciliation / Stripe API calls inside a webhook handler** use the credential mode recorded on the invoice (`invoices.stripe_credential_mode`) when present, so an in-flight live session reconciles in live context regardless of the org's current live flag.
  - This preserves freeze-in-flight (a live session created before disable completes and reconciles) while blocking new live initiation. Test and live credential sets remain stored concurrently for re-verification and regression testing.
- **FR-002**: The system MUST resolve payment credentials exclusively from the organisation that owns the invoice (`organization_id` on the invoice) for checkout creation, Stripe invoice create/revise/send/fetch/delete, payment reconciliation, and customer payment UI initialization.
- **FR-003**: The system MUST NOT use a global default Stripe account for any organisation that has per-organisation credentials configured; it MUST NOT route one organisation's payment through another organisation's credentials under any circumstance.
- **FR-004**: Secret keys and webhook signing secrets MUST be encrypted at rest and MUST NOT be exposed to browsers, client-side code, or routine application logs.
- **FR-005**: Publishable keys MAY be exposed to the client only in the context of paying an invoice owned by that organisation, and only that organisation's publishable key.
- **FR-006**: Inbound Stripe webhooks MUST be received on organisation-specific endpoints that identify the organisation before signature verification, using that organisation's webhook signing secret for verification.
- **FR-007**: After signature verification, webhook processing MUST confirm that affected Mason invoices and payments belong to the same organisation as the endpoint; otherwise the event MUST be rejected without state change.
- **FR-008**: Each organisation MUST have a live-payments-enabled flag (or equivalent) defaulting to **disabled**; only when enabled may that organisation process live (non-test) charges through its registered live credentials.
- **FR-009**: Operators MUST be able to enable or disable live payments per organisation without changing other organisations' settings and without requiring a software deployment (configuration change only).
- **FR-009a**: Disabling live payments MUST block new live payment initiation immediately; it MUST NOT prevent reconciliation of in-flight live checkout sessions created before disable when the provider confirms successful payment.
- **FR-009b**: In-flight live sessions MUST retain the live credential context (keys and webhook signing secret) active at session creation for completion and webhook verification, even if the live-payments-enabled flag is turned off before payment completes.
- **FR-010**: Only **platform implementation operators** (not organisation administrators or general staff) MAY register, rotate, or update Stripe credential sets and toggle live-payments-enabled per organisation; self-service credential entry by workshop staff is out of scope for v1.
- **FR-011**: The system MUST support Stripe test-mode credentials per organisation for full round-trip verification (invoice/checkout → pay → webhook → Mason paid/reconciled) before live enablement.
- **FR-012**: Live enablement for an organisation MUST be **hard-blocked** until the system automatically records a successful test-mode round trip for that organisation (test payment completed, org-scoped webhook verified with test signing secret, Mason invoice reconciled as paid in test mode); no attestation-only bypass in v1. First production target is the Churchill organisation on its own live Stripe account.
- **FR-013**: Live enablement SHOULD additionally be preceded by a small real charge on that organisation's live account that is refunded, documented as part of the operator go-live checklist (operator process; not a separate system gate in v1).
- **FR-014**: Paid state on Mason invoices MUST remain consistent with Stripe's paid/open status for the same invoice after any supported payment flow or webhook reconciliation.
- **FR-014a**: **Checkout session path** — Mason MUST mark an invoice paid only upon verified `checkout.session.completed` (with successful payment intent per existing full-payment rules); no other event type may be the sole paid trigger for this path.
- **FR-014b**: **Hosted Stripe invoice path** — Mason MUST mark an invoice paid only upon verified `invoice.paid` for the linked Stripe invoice; checkout-session events MUST NOT set paid for invoices on this path.
- **FR-014c**: Events such as `payment_intent.succeeded` MUST NOT alone set Mason invoice paid state; they MAY update non-paid payment metadata when useful.
- **FR-015**: Webhook handling MUST align with the event types each organisation's Stripe account is actually subscribed to; handlers for unsubscribed or non-path-authoritative event types MUST NOT be the sole or conflicting driver of paid-state updates.
- **FR-016**: Existing payment data model, reconciliation tables, and invoice/payment columns MUST remain; this phase changes credential resolution and webhook verification only, not the core payment schema.
- **FR-017**: Stripe Connect and platform-managed connected accounts are explicitly out of scope; each organisation uses its own independent Stripe account.

### Architectural Constraints *(mandatory when relevant)*

- **AC-001 (Tenant isolation)**: Credential lookup, API calls, webhooks, and UI payment initialization MUST all enforce organisation boundary on every code path; missing or ambiguous organisation context MUST fail closed (no payment), never guess another tenant.
- **AC-002 (RLS as boundary)**: Organisation payment credentials and enablement flags MUST be protected by database row-level security; only platform-operator roles MAY write credential or live-enablement data; organisation members MAY read non-secret payment status only where needed for day-to-day work; UI permission checks are not sufficient for money-handling secrets.
- **AC-003 (No Connect v1)**: Implementation MUST NOT assume Stripe Connect; storing per-organisation secret keys (encrypted) is an accepted v1 tradeoff documented here for planners.

### Key Entities *(include if feature involves data)*

- **Organisation payment configuration**: Per-organisation **test** and **live** credential triplets (secret key, publishable key, webhook signing secret each), plus a live-payments-enabled flag that selects which triplet is active at runtime, and a **test-round-trip-passed-at** (or equivalent) timestamp/flag set only by a successful automated test reconciliation; owned by exactly one organisation.
- **Invoice**: Existing entity; `organization_id` determines which payment configuration applies to all payment actions on that invoice.
- **Payment reconciliation record**: Existing linkage between Mason invoice/payment state and Stripe objects; must record which organisation's account was used.
- **Webhook delivery context**: Organisation identifier carried in the webhook endpoint (outside signed payload) plus verified Stripe event referencing Mason invoice/payment IDs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a two-organisation test audit, 100% of completed payments for organisation A appear only in organisation A's Stripe account and 100% for organisation B in B's account (zero cross-tenant routing).
- **SC-002**: Operators can register credentials for a new organisation and complete a documented test-mode round trip (invoice or checkout → pay → webhook → Mason reconciled) in under 30 minutes excluding external Stripe dashboard setup time; the system records pass automatically and unlocks live enablement without manual attestation.
- **SC-003**: Enabling or disabling live payments for one organisation takes effect for new payment initiation within 1 minute via configuration alone, with no other organisation's live setting changed.
- **SC-004**: After go-live of paid-state fixes, zero newly completed payments exhibit Mason "paid" while Stripe shows full balance outstanding on the same invoice (measured over pilot monitoring period for Churchill and test orgs).
- **SC-005**: Churchill can process live customer payments through its own Stripe account while at least one other organisation remains disabled for live payments, with no payments from the disabled organisation reaching Churchill's account.
- **SC-006**: 100% of inbound webhooks that update invoice state pass signature verification with the receiving organisation's signing secret and pass organisation-invoice ownership check.

## Assumptions

- Every invoice relevant to payment already has a correct `organization_id`; no new invoice-to-organisation mapping work is required.
- Operators have access to each workshop's independent Stripe account (not Connect) and can configure organisation-specific webhook URLs in that account's dashboard.
- The existing set of payment features (checkout, hosted invoice, reconciliation) remains unchanged in scope; only routing, credentials, verification, and paid-state consistency improve.
- Encryption-at-rest for integration secrets is already available in the platform (as used for other per-organisation integrations) and can be reused for Stripe secrets.
- Each organisation maintains both test and live credential sets concurrently; go-live does not require deleting or replacing test credentials.
- Churchill is the first organisation targeted for live enablement after its own test and small refunded live charge verification.
- Organisations without registered credentials cannot take payments until an operator completes setup (acceptable for v1).
- Disabling live payments blocks new live payment initiation immediately; in-flight live checkout sessions created before disable may complete and reconcile on the live credential context from session creation.

## Dependencies

- Existing multi-organisation tenancy and invoice ownership (`organization_id`).
- Existing Stripe checkout, hosted invoice, and webhook reconciliation flows (behaviour preserved, credentials per org).
- Platform-operator-only tooling or secure process to enter and rotate per-organisation credentials (may be admin UI, script, or database procedure — decided in planning; not exposed to organisation admins in v1).

## Out of Scope (v1)

- Stripe Connect or platform-managed connected accounts.
- Self-service credential entry by organisation administrators.
- New payment product features (partial payments rules changes, new payment methods, etc.) beyond fixing paid-state consistency bugs.
- Automatic reversal when switching from test to live credentials.
- Changing core payment/reconciliation database schema.
