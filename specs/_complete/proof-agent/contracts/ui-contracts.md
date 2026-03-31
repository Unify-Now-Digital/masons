# UI Contracts: Proof Agent Frontend Components

---

## ProofPanel

**File**: `src/modules/proofs/components/ProofPanel.tsx`
**Location**: Rendered inside `OrderDetailsSidebar` (and `OrderDetailsSidePanel` if applicable), gated on `order.id`

### Props

```ts
interface ProofPanelProps {
  orderId: string;
  orderProductPhotoUrl: string | null;
  orderInscriptionText: string | null;    // pre-populated from inscriptions query
  customerEmail: string | null;
  customerPhone: string | null;
}
```

### Internal data

| Hook | Purpose |
|------|---------|
| `useProofByOrder(orderId)` | Fetches latest proof row for the order |
| `useGenerateProof()` | Calls `proof-generate` Edge Function |
| `useApproveProof()` | Direct Supabase update: `sent → approved` |
| `useRequestProofChanges()` | Direct Supabase update: `sent → changes_requested` |

### State-to-UI mapping

| Proof state | Panel content |
|------------|---------------|
| No proof / `not_started` | "Generate Proof" button → opens `ProofGenerateForm` |
| `generating` | Spinner + "Generating proof…" message |
| `draft` | Rendered image preview + "Send to Customer" button + "Regenerate" button |
| `sent` | Sent info (channel, timestamp) + "Mark Approved" button + "Request Changes" button + conversation link |
| `approved` | Green "Approved" badge + approval timestamp + read-only image |
| `changes_requested` | Change note displayed + "Regenerate" button (reopens `ProofGenerateForm`) |
| `failed` | Error message + "Retry" button (reopens `ProofGenerateForm`) + "Upload Manually" option |

### Constraints

- "Send to Customer" button MUST only render when `state = 'draft'`
- "Mark Approved" button MUST only render when `state = 'sent'`
- Proof image display uses a signed URL fetched via `supabase.storage.from('proof-renders').createSignedUrl(storagePath, 3600)`
- No state is ever displayed as "Approved" unless `proof.state === 'approved'` exactly

---

## ProofGenerateForm

**File**: `src/modules/proofs/components/ProofGenerateForm.tsx`
**Usage**: Modal or inline panel opened from `ProofPanel` for `not_started`, `failed`, `draft` (regenerate), `changes_requested` states.

### Props

```ts
interface ProofGenerateFormProps {
  orderId: string;
  initialInscriptionText: string;   // pre-populated
  initialStonePhotoUrl: string;     // pre-populated from order.product_photo_url
  isChangesRequested?: boolean;     // if true, show previous changes_note as context
  changesNote?: string | null;
  onSuccess: () => void;
  onClose: () => void;
}
```

### Fields

| Field | Type | Required | Pre-populated from |
|-------|------|----------|--------------------|
| Inscription text | Textarea | Yes | `initialInscriptionText` |
| Stone photo | Text input (URL) + upload option | Yes | `initialStonePhotoUrl` |
| Font style | Select (serif / sans-serif / script / custom) | No | — |
| Additional instructions | Textarea | No | `changesNote` if `isChangesRequested` |

### Behaviour

- "Generate" button calls `useGenerateProof().mutate({ order_id, inscription_text, stone_photo_url, font_style, additional_instructions })`
- While pending: "Generating…" spinner, all fields disabled
- On success: call `onSuccess()` — panel re-renders to show the draft image
- On error: inline error message; form re-enabled

---

## ProofSendModal

**File**: `src/modules/proofs/components/ProofSendModal.tsx`
**Usage**: Modal opened from `ProofPanel` "Send to Customer" button

### Props

```ts
interface ProofSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proofId: string;
  renderUrl: string | null;          // signed URL for preview
  defaultEmail: string | null;
  defaultPhone: string | null;
}
```

### Internal mutations

| Hook | Purpose |
|------|---------|
| `useSendProof()` | Calls `proof-send` Edge Function |

### Screens

**Channel Selection + Preview**:
- Channel checkboxes: Email, WhatsApp (both allowed simultaneously)
- Email field (pre-populated from `defaultEmail`; required if Email checked)
- Phone field (pre-populated from `defaultPhone`; required if WhatsApp checked)
- Message text area (optional; default: "Please review your memorial stone proof.")
- Proof image thumbnail (from `renderUrl`)
- "Send" button — disabled unless at least one channel is checked and required fields are filled
- While pending: "Sending…" state

**Success screen**:
- Confirmation: "Proof sent successfully"
- Shows which channels were used
- "Close" button

**Error**:
- Inline error message; "Try again" button

### Constraints

- MUST NOT allow sending unless `proof.state === 'draft'` (enforced by disabled button in `ProofPanel` — modal is only openable from that state)
- If send partially fails (one channel fails), surface the error; do not silently record a partial send

---

## ProofApprovalBadge

**File**: `src/modules/proofs/components/ProofApprovalBadge.tsx`
**Usage**: Order list rows (inline), Job list rows (inline)

### Props

```ts
interface ProofApprovalBadgeProps {
  state: ProofState | null | undefined;  // null = no proof exists
  size?: 'sm' | 'default';
}
```

### Rendering

| State | Badge text | Badge colour |
|-------|-----------|--------------|
| `null` / no proof | "No Proof" | gray outline |
| `not_started` | "Not Started" | gray outline |
| `generating` | "Generating…" | blue |
| `draft` | "Draft" | yellow |
| `sent` | "Sent" | blue |
| `approved` | "Approved" | green |
| `changes_requested` | "Changes Requested" | amber |
| `failed` | "Failed" | red |

### Constraints

- Green "Approved" badge MUST only render when `state === 'approved'` exactly
- Component is read-only; clicking it does nothing (navigation handled by parent)

---

## Job Start Gate (EditJobDrawer + JobsPage)

**Files modified**: `src/modules/jobs/components/EditJobDrawer.tsx`, `src/modules/jobs/pages/JobsPage.tsx`

### Added hook

```ts
// In EditJobDrawer and any inline job status change UI:
const { data: latestProof } = useProofByOrder(job.order_id ?? null);
const proofApproved = isProofApproved(latestProof);
const jobStartBlocked = !!job.order_id && !proofApproved;
```

### Status field gate (EditJobDrawer)

```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <div>
      <SelectItem
        value="in_progress"
        disabled={jobStartBlocked}
      >
        In Progress
      </SelectItem>
    </div>
  </TooltipTrigger>
  {jobStartBlocked && (
    <TooltipContent>
      Proof not yet approved — approve the customer proof before starting this job
    </TooltipContent>
  )}
</Tooltip>
```

### Constraints

- The gate applies ONLY to transitions to `in_progress`
- Jobs with no `order_id` (no linked order) are NOT gated
- The tooltip text must be visible without requiring a second hover or click
