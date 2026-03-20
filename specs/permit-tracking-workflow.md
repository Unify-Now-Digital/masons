# Permit Tracking Workflow & UI Specification

## Executive Summary

This spec defines a complete permit tracking workflow for the Memorial Mason Management app, leveraging the **existing** Supabase schema (`order_permits`, `permit_activity_log`, `permit_forms`, and `orders`) and the existing `permitAgent` module. The goal is to enable masons to track, send, receive, and manage permit paperwork for specific orders — from initial requirement through cemetery approval — with semi-automated email communication to both **customers** (for signature collection) and **cemeteries/authorities** (for permit submission).

---

## Existing Data Model (Already in Supabase)

### `orders` table (relevant fields)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `order_number` | integer | Display ID |
| `customer_name` | text | Deceased name |
| `person_name` | text | Customer/family contact name |
| `customer_email` | text | Customer email for communication |
| `customer_phone` | text | Customer phone |
| `order_type` | text | 'New Memorial' or 'Renovation' |
| `permit_status` | text | `'pending'`, `'form_sent'`, `'customer_completed'`, `'approved'` |
| `permit_cost` | decimal(10,2) | Cost of permit, included in order total |
| `permit_form_id` | uuid FK | Reference to `permit_forms` table |
| `location` | text | Cemetery/churchyard name |
| `installation_date` | date | Target install date |
| `material` | text | Stone material |
| `sku` | text | Grave number |

### `order_permits` table (1:1 with orders via unique index)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `order_id` | uuid FK | Links to orders (unique, cascade delete) |
| `permit_phase` | text | `REQUIRED` → `SEARCHING` → `FORM_FOUND` → `PREFILLED` → `SENT_TO_CLIENT` → `SUBMITTED` → `APPROVED` |
| `authority_name` | text | Cemetery/council name |
| `authority_contact` | text | Authority email address |
| `form_url` | text | URL to discovered permit form |
| `readiness_score` | integer | 0-100 progress indicator |
| `fee_paid` | boolean | Whether permit fee has been paid |
| `submission_date` | date | When submitted to authority |
| `prefilled_data` | jsonb | AI pre-filled form field data |
| `notes` | text | Free-text notes |

### `permit_activity_log` table (timeline for each permit)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `order_permit_id` | uuid FK | Links to order_permits |
| `activity_type` | text | `SEARCH_STARTED`, `FORM_FOUND`, `PREFILLED`, `SENT_TO_CLIENT`, `CLIENT_RETURNED`, `SUBMITTED`, `FOLLOW_UP_SENT`, `APPROVED`, `NOTE` |
| `description` | text | Human-readable description |
| `metadata` | jsonb | Structured data (email addresses, links, etc.) |

### `permit_forms` table (reusable form library)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | Cemetery/authority name |
| `link` | text | URL to official form |
| `note` | text | Internal notes |

---

## Workflow: End-to-End Permit Lifecycle

### Phase Progression (maps to `order_permits.permit_phase`)

```
REQUIRED → SEARCHING → FORM_FOUND → PREFILLED → SENT_TO_CLIENT → SUBMITTED → APPROVED
```

### Detailed Workflow Steps

#### 1. REQUIRED (Initial State)
- **Trigger**: Order created, or user clicks "Sync Orders" to initialize permits for existing orders
- **What happens**: An `order_permits` row is created with `permit_phase = 'REQUIRED'`, `readiness_score = 0`
- **User action**: Select the order in the pipeline view to begin working on its permit
- **Automated**: `initializePermitsForOrders()` creates permit entries for all orders that don't have one

#### 2. SEARCHING (AI Form Discovery)
- **Trigger**: User clicks "AI Search for Form" in the detail panel
- **What happens**:
  - AI searches for the cemetery/churchyard's official memorial permit application form
  - Uses the order's `location` field as the search query
  - Activity logged: `SEARCH_STARTED`
- **Output**: Report with links to discovered forms, authority name, and contact email
- **Data updated**: `authority_name`, `authority_contact`, `form_url`

#### 3. FORM_FOUND (Form Discovered)
- **Trigger**: AI search returns results
- **What happens**:
  - `form_url` populated with the primary discovered link
  - `authority_name` and `authority_contact` populated
  - `readiness_score` increases by ~30 points
  - Activity logged: `FORM_FOUND`
  - Optionally, a `permit_forms` entry is created/linked for reuse
- **User can**: View the form in a new tab, link to an existing permit form from the library

#### 4. PREFILLED (Data Pre-filled)
- **Trigger**: User clicks "Auto Pre-fill Form"
- **What happens**:
  - AI maps order data into form fields:
    - `authority_recipient` ← `authority_name`
    - `deceased_full_name` ← `customer_name`
    - `memorial_dimensions` ← from order/product specs
    - `material_type` ← `material`
    - `inscription_summary` ← from proof data
    - `grave_location` ← `location` / `sku` (grave number)
  - `prefilled_data` jsonb updated with structured field data
  - `readiness_score` increases by ~20 points
  - Activity logged: `PREFILLED`
- **User can**: Review and edit the pre-filled data before proceeding

#### 5. SENT_TO_CLIENT (Awaiting Customer Signature)
- **Trigger**: User clicks "Send to Client for Signature"
- **What happens**:
  - **Email sent to customer** (`customer_email` from the order) via Gmail integration
  - Email includes:
    - Pre-filled permit form (as attachment or link)
    - Instructions for signing and returning
    - Order reference number
  - `permit_phase` → `SENT_TO_CLIENT`
  - `readiness_score` increases by ~15 points
  - Activity logged: `SENT_TO_CLIENT` with email metadata
  - Email thread tracked in unified inbox for reply monitoring
- **Customer action**: Sign the form and return it (via email reply or upload)
- **Follow-up**: User can send follow-up reminders (activity type: `FOLLOW_UP_SENT`)
- **Completion**: When customer returns signed form, user marks it as received → activity: `CLIENT_RETURNED`

#### 6. SUBMITTED (Submitted to Cemetery/Authority)
- **Trigger**: User clicks "Submit to Authority" (requires signed form from customer)
- **What happens**:
  - **Email sent to authority** (`authority_contact`) via Gmail integration
  - Email includes:
    - Formal cover letter with order details
    - Completed and signed permit application
    - Payment reference (if `fee_paid = true`)
  - `permit_phase` → `SUBMITTED`
  - `submission_date` set to current date
  - `readiness_score` increases by ~25 points
  - Activity logged: `SUBMITTED` with email metadata
  - Email thread tracked in unified inbox
- **Follow-up**: User can send follow-up emails to the authority

#### 7. APPROVED (Permit Granted)
- **Trigger**: User clicks "Mark as Approved" after receiving approval from authority
- **What happens**:
  - `permit_phase` → `APPROVED`
  - `readiness_score` → 100
  - `orders.permit_status` updated to `'approved'`
  - Activity logged: `APPROVED`
- **Effect**: Order is now cleared for installation scheduling

---

## UI Design: Enhanced Permit Agent Page

### Layout: 3-Column Pipeline Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Bot] Permit Agent          [Refresh] [Sync Orders] [Send to Client]│
│  AI-powered permit tracking                                          │
├──────────────┬───────────────────────────────┬───────────────────────┤
│ FILTERS      │                               │                       │
│ [All (24)]   │  PIPELINE TABLE               │  DETAIL PANEL         │
│ [Urgent (3)] │  ┌──┬──────────┬─────┬──────┐ │                       │
│ [Required]   │  │# │Deceased  │Phase│Ready │ │  Order: John Smith    │
│ [Searching]  │  ├──┼──────────┼─────┼──────┤ │  #1234 · New Memorial │
│ [Form Found] │  │12│J. Smith  │REQ  │ 0%   │ │                       │
│ [Pre-filled] │  │15│M. Jones  │SRCH │30%   │ │  ┌─ Permit Progress ─┐│
│ [Sent Client]│  │23│A. Brown  │APPR │100%  │ │  │ [=====>    ] 45%  ││
│ [Submitted]  │  └──┴──────────┴─────┴──────┘ │  │ REQ>SRCH>FND>PRE  ││
│ [Approved]   │                               │  └────────────────────┘│
│              │  Search: [________________]   │                       │
│              │                               │  ┌─ Order Details ────┐│
│              │                               │  │ Location: Landican ││
│              │                               │  │ Install: 15 Apr    ││
│              │                               │  │ Material: Granite  ││
│              │                               │  └────────────────────┘│
│              │                               │                       │
│              │                               │  ┌─ Actions ──────────┐│
│              │                               │  │ [AI Search]        ││
│              │                               │  │ [View Form]        ││
│              │                               │  │ [Auto Pre-fill]    ││
│              │                               │  │ [Send to Client]   ││
│              │                               │  │ [Submit to Auth]   ││
│              │                               │  │ [Mark Approved]    ││
│              │                               │  └────────────────────┘│
│              │                               │                       │
│              │                               │  ┌─ Activity Timeline ┐│
│              │                               │  │ ● Form found  2h   ││
│              │                               │  │ ● Pre-filled  1h   ││
│              │                               │  │ ○ Sent client  Now ││
│              │                               │  └────────────────────┘│
└──────────────┴───────────────────────────────┴───────────────────────┘
```

### New UI Components Needed

#### 1. `SendToClientDialog` (new component)
**Purpose**: Compose and send email to customer requesting form signature.

**Pre-populated fields**:
- **To**: `order.customer_email` (from order's linked customer)
- **Subject**: `"Memorial Permit Form - [customer_name] - [location]"`
- **Body**: Template with order details, form link, signature instructions
- **Attachment indicator**: Shows pre-filled form will be attached

**Actions**:
- Send email via `sendGmailNewEmail()`
- Log activity: `SENT_TO_CLIENT`
- Update phase: `SENT_TO_CLIENT`
- Track in unified inbox

#### 2. `FollowUpDialog` (new component)
**Purpose**: Send follow-up reminders to either customer or authority.

**Options**:
- **Recipient**: Toggle between customer email and authority contact
- **Subject**: Pre-populated with "Follow-up: Memorial Permit..."
- **Body**: Context-aware template referencing original submission
- **History**: Shows previous follow-ups sent

**Actions**:
- Send email via `sendGmailNewEmail()`
- Log activity: `FOLLOW_UP_SENT`

#### 3. `ClientReturnedButton` (enhancement to PermitDetailPanel)
**Purpose**: Mark that the customer has returned the signed form.

**Actions**:
- Log activity: `CLIENT_RETURNED`
- Auto-advance readiness score
- Enable "Submit to Authority" button

#### 4. Enhanced `PermitDetailPanel` actions section
Add new buttons to the existing actions card:

```tsx
// After "Auto Pre-fill Form" button:
<Button onClick={onSendToClient} disabled={!permit.prefilled_data}>
  <Mail /> Send to Client for Signature
</Button>

<Button onClick={onClientReturned} disabled={permit.permit_phase !== 'SENT_TO_CLIENT'}>
  <UserCheck /> Client Returned Signed Form
</Button>

// Existing "Submit to Authority" button (already present)

<Button onClick={onFollowUp} disabled={!['SENT_TO_CLIENT', 'SUBMITTED'].includes(phase)}>
  <Reply /> Send Follow-up
</Button>
```

#### 5. Summary Stats Bar (enhancement to page header)
Show aggregate counts:

```
| Awaiting Search: 5 | Awaiting Client: 3 | Awaiting Authority: 2 | Approved: 14 |
```

---

## Email Templates

### Template 1: Send to Client for Signature
```
Subject: Memorial Permit Application - {customer_name} - {location}

Dear {person_name},

We are writing regarding the memorial permit application for {customer_name} at {location}.

We have prepared the permit application form for {authority_name}. Please review the attached form, sign where indicated, and return it to us at your earliest convenience.

Order Details:
- Order Reference: #{order_number}
- Location: {location}
- Grave Number: {sku}
- Memorial Type: {order_type}
- Material: {material}

{form_url ? "You can also view the form online at: " + form_url : ""}

If you have any questions, please don't hesitate to contact us.

Kind regards,
Memorial Mason Management
```

### Template 2: Submit to Authority (existing, already in SubmitPermitDialog)
Already implemented — sends formal application to `authority_contact`.

### Template 3: Follow-up Reminder
```
Subject: Follow-up: Memorial Permit Application - {customer_name} - {location}

Dear {recipient},

I am writing to follow up on the memorial permit application submitted on {submission_date} for:

- Deceased: {customer_name}
- Location: {location}
- Grave Number: {sku}

{to_customer ? "Could you please return the signed form at your earliest convenience?" : "Could you please provide an update on the status of this application?"}

Thank you for your time.

Kind regards,
Memorial Mason Management
```

---

## Data Flow: Orders ↔ Permits Integration

### How `orders.permit_status` syncs with `order_permits.permit_phase`

| `order_permits.permit_phase` | `orders.permit_status` |
|------------------------------|----------------------|
| `REQUIRED`, `SEARCHING`, `FORM_FOUND`, `PREFILLED` | `pending` |
| `SENT_TO_CLIENT` | `form_sent` |
| `SUBMITTED` (after client returned) | `customer_completed` |
| `APPROVED` | `approved` |

The sync should happen automatically when `permit_phase` is updated, either:
- In the `updateOrderPermit` mutation's `onSuccess` callback, or
- Via a new API function that updates both tables in a single call

### How `permit_forms` (library) integrates

- When AI discovers a form, offer to save it to the `permit_forms` library
- When creating a new permit, allow selecting from existing `permit_forms` library
- The `orders.permit_form_id` FK links the order to a reusable form template
- `PermitFormPicker` component already exists in the orders module

---

## Implementation Phases

### Phase 1: Enhanced Permit Detail Panel (modify existing)
- Add "Send to Client" button + dialog
- Add "Client Returned" button
- Add "Send Follow-up" button + dialog
- Add summary stats to page header
- Wire buttons to existing API + activity logging

### Phase 2: Order Status Sync
- Auto-update `orders.permit_status` when `order_permits.permit_phase` changes
- Show permit phase badge on the orders table
- Link from orders detail sidebar to permit agent page

### Phase 3: Email Integration Enhancement
- Create `SendToClientDialog` component
- Create `FollowUpDialog` component
- Use `sendGmailNewEmail()` for all outbound emails
- Track all email threads in unified inbox via conversation IDs

### Phase 4: Dashboard Metrics
- Add summary counters (by phase) to page header
- Add "days since last activity" indicator
- Add overdue follow-up alerts (no activity in 7+ days for SENT_TO_CLIENT or SUBMITTED)

---

## API Changes Needed

### New API function: `updatePermitWithOrderSync`
```typescript
async function updatePermitWithOrderSync(
  permitId: string,
  payload: OrderPermitUpdate,
  orderId: string
): Promise<OrderPermit> {
  // Update the permit
  const permit = await updateOrderPermit(permitId, payload);

  // Sync order.permit_status based on new phase
  const statusMap: Record<string, string> = {
    'SENT_TO_CLIENT': 'form_sent',
    'SUBMITTED': 'customer_completed',
    'APPROVED': 'approved',
  };

  const newOrderStatus = statusMap[payload.permit_phase || ''];
  if (newOrderStatus) {
    await supabase
      .from('orders')
      .update({ permit_status: newOrderStatus })
      .eq('id', orderId);
  }

  return permit;
}
```

### Enhanced pipeline query
The existing `fetchPermitPipeline()` already joins `order_permits` with `orders` and `permit_activity_log` — no schema changes needed.

---

## What This Spec Does NOT Include

- File upload for signed forms (customers return via email reply)
- PDF generation of pre-filled forms (link to external form URL)
- Automated reply detection (manual "Client Returned" button)
- Payment processing for permit fees (manual `fee_paid` toggle)
- Multi-permit per order (1:1 relationship via unique index)
- Changes to the existing Supabase schema (all tables/columns already exist)

---

## Success Criteria

1. Users can track every order's permit from "Required" through "Approved"
2. Users can send pre-filled permit forms to customers for signature via email
3. Users can submit completed permits to cemetery authorities via email
4. All email threads are tracked in the unified inbox
5. Users can send follow-up reminders to customers and authorities
6. Order permit_status stays in sync with the permit pipeline phase
7. Urgent permits (< 30 days to install) are highlighted
8. Activity timeline shows complete audit trail of all permit actions
