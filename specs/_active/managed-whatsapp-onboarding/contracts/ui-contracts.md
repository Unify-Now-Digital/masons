# UI Contracts: Managed WhatsApp Onboarding Modal

---

## ManagedWhatsAppModal

**File**: `src/modules/inbox/components/ManagedWhatsAppModal.tsx`

### Props

```ts
interface ManagedWhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

### Internal data dependencies (hooks called inside component)

| Hook | Purpose | When active |
|------|---------|-------------|
| `useManagedWhatsAppStatus()` | Current state, connected_requirements, status_reason_message | Always |
| `useManagedWhatsAppMeta(enabled)` | Pre-populate business form | `enabled` = `status === 'action_required'` |
| `useManagedWhatsAppStart()` | Step 1 confirm button | Called on confirm |
| `useManagedWhatsAppSubmitBusiness()` | Step 2 + Step 4 submit | Called on form submit |
| `useManagedWhatsAppDisconnect()` | Connected screen disconnect | Called on disconnect click |

### Screen contracts by ModalStep

#### Step: `start`
- Heading: "Connect WhatsApp (Managed)"
- Body: brief explanation that no Twilio credentials are needed
- CTA: "Get Started" button → calls `managedStartMutation.mutate()`
- While mutation pending: button shows "Starting…", disabled
- On mutation success: modal stays open; step re-derives from updated `managedStatus`
- On mutation error: inline error message under the button; button re-enabled

#### Step: `business_form`
- Heading: "Your Business Details"
- Sub-heading: "Step 2 of 3"
- Fields:
  - Business name (`required`, type `text`)
  - Business email (`required`, type `email`)
  - Business phone (`required`, type `tel`, placeholder `+44...`)
- Initial field values: empty strings (this step is only reached fresh via `start`)
- Validation: HTML5 `required` + `type` attributes; submit button disabled when any field empty
- CTA: "Submit" → calls `managedSubmitMutation.mutate({ connection_id, business_name, business_email, business_phone })`
- `connection_id` sourced from `managedStatus.connection_id`
- While mutation pending: button shows "Submitting…", disabled
- On success: step re-derives to `pending` from updated status
- On error: inline error toast or error message

#### Step: `pending`
- Heading: "Pending Provider Review"
- Body: "Your details have been submitted. We're waiting for WhatsApp provider confirmation. This may take a few minutes — you'll see your connection status update automatically."
- Status indicator: subtle spinner or animated dot
- No CTA button (nothing for user to do)
- Close button only (user can close modal; status remains in dropdown)

#### Step: `action_required`
- Heading: "Action Required"
- Reason block: displays `managedStatus.status_reason_message` (if present) in a highlighted callout; falls back to "Provider needs additional information."
- Sub-heading: "Please review and re-submit your details"
- Fields: same as `business_form` but **pre-populated** from `useManagedWhatsAppMeta`
- Behaviour on meta load: show loading skeleton in fields while `isManagedMetaLoading`; populate when ready
- CTA: "Re-submit" → calls same `managedSubmitMutation.mutate(...)` with updated form values
- On success: step re-derives to `pending`
- On error: inline error message

#### Step: `failed`
- Heading: "Onboarding Failed"
- Body: `managedStatus.status_reason_message` or fallback "Something went wrong during provider setup."
- CTA: "Start Over" button → calls `managedStartMutation.mutate()`; on success step re-derives to `business_form`

#### Step: `connected`
- Heading: "WhatsApp Connected"
- Display: `managedStatus.connected_requirements` only contains **boolean flags** (`has_from_address`, `has_sender_sid`); the actual number string is NOT returned by the status endpoint. Always display "Provider-assigned number" as a static confirmation label. (A future improvement can add a direct table query similar to `fetchManagedWhatsAppMeta` to retrieve the actual `display_number` string.)
- Green checkmark or badge
- CTA: "Disconnect" button → calls `managedDisconnectMutation.mutate(managedStatus.connection_id!)`
- While mutation pending: button shows "Disconnecting…", disabled
- On success: step re-derives to `disconnected`

#### Step: `disconnected`
- Heading: "WhatsApp Disconnected"
- Body: "Your WhatsApp connection has been disconnected. Past conversations remain visible."
- CTA: "Start New Onboarding" button → calls `managedStartMutation.mutate()`; on success re-derives to `business_form`

---

## WhatsAppConnectionStatus — Managed Mode Changes

**File**: `src/modules/inbox/components/WhatsAppConnectionStatus.tsx`

### Additions

```ts
const [managedModalOpen, setManagedModalOpen] = useState(false);
```

### Removals

- `managedOpen` state variable
- `handleStartManaged()` handler
- `handleManagedSubmit()` handler
- `businessName`, `businessEmail`, `businessPhone` state variables
- The two `<Dialog>` blocks inside the managed mode `<>` JSX (lines ~421–465)

### Dropdown menu item for managed mode (replaces current ad-hoc items)

```ts
// Helper — returns label for the single managed-mode menu item
function getManagedMenuLabel(status: string | undefined, exists: boolean): string {
  if (!exists || status === 'draft' || status === 'not_connected') return 'Connect via Managed WhatsApp';
  switch (status) {
    case 'collecting_business_info':  return 'Resume onboarding';
    case 'pending_provider_review':
    case 'provisioning':
    case 'requested':                 return 'View pending status';
    case 'pending_meta_action':
    case 'action_required':           return 'Resolve action required';
    case 'failed':
    case 'error':
    case 'degraded':                  return 'Onboarding failed — start over';
    case 'connected':                 return 'Manage connection';
    case 'disconnected':              return 'Reconnect WhatsApp';
    default:                          return 'Connect via Managed WhatsApp';
  }
}
```

Single `<DropdownMenuItem>` for managed mode:
```tsx
<DropdownMenuItem onSelect={(e) => { e.preventDefault(); setManagedModalOpen(true); }}>
  <Link2 className="h-4 w-4 mr-2" />
  {getManagedMenuLabel(managedStatus?.status, managedStatus?.exists ?? false)}
</DropdownMenuItem>
```

Plus the `<ManagedWhatsAppModal>` rendered adjacent to the `<DropdownMenu>`:
```tsx
<ManagedWhatsAppModal open={managedModalOpen} onOpenChange={setManagedModalOpen} />
```

### "Send blocked" item (unchanged logic, keep existing)

```tsx
{!managedConnected && managedStatus?.status && managedStatus.status !== 'draft' && (
  <DropdownMenuItem disabled>
    Send blocked until managed status is connected
  </DropdownMenuItem>
)}
```

---

## fetchManagedWhatsAppMeta — API contract

```ts
// src/modules/inbox/api/whatsappConnections.api.ts (additive)

/**
 * Fetch business meta stored on the most-recent managed connection row.
 * Used to pre-populate the business form on action_required re-entry.
 * RLS ensures only own row is returned.
 */
export async function fetchManagedWhatsAppMeta(): Promise<ManagedWhatsAppMeta | null>
```

Returns `null` when no row exists or `meta` is null/empty.  
Throws on Supabase query error.

---

## disconnectManagedWhatsApp — API contract

```ts
// src/modules/inbox/api/whatsappConnections.api.ts (additive)

/**
 * Soft-disconnect the managed WhatsApp connection.
 * Sets state = 'disconnected'; preserves row for audit.
 */
export async function disconnectManagedWhatsApp(connectionId: string): Promise<void>
```

Throws on Supabase update error.  
Caller must have an authenticated session (RLS enforced).
