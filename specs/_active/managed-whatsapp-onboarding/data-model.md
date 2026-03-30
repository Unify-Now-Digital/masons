# Data Model: Managed WhatsApp Onboarding UI

**Frontend-only types and state machine — no DB schema changes.**

---

## 1. Managed Status Type (Existing — for reference)

Defined in `src/modules/inbox/api/whatsappConnections.api.ts`:

```ts
export interface ManagedWhatsAppStatusResponse {
  exists: boolean;
  mode: 'managed';
  connection_id?: string;
  status:
    | 'draft'               // API virtual: no row exists
    | 'collecting_business_info'
    | 'provisioning'
    | 'pending_meta_action'
    | 'pending_provider_review'
    | 'action_required'
    | 'connected'
    | 'degraded'
    | 'failed'
    | 'disconnected'
    | 'error'
    | 'not_connected'
    | 'requested';
  status_reason_code?: string | null;
  status_reason_message?: string | null;
  action_required?: boolean;
  connected_requirements?: {
    has_account_sid?: boolean;
    has_sender_sid: boolean;
    has_from_address: boolean;
    provider_ready: boolean;
  };
  last_synced_at?: string | null;
}
```

---

## 2. New: ManagedWhatsAppMeta (frontend type)

Add to `src/modules/inbox/api/whatsappConnections.api.ts`:

```ts
export interface ManagedWhatsAppMeta {
  business_name: string;
  business_email: string;
  business_phone: string;
  meta_business_id?: string | null;
}
```

Fetched via direct Supabase query on `whatsapp_managed_connections.meta` (JSON column).  
Only requested when `status === 'action_required'`.

---

## 3. New: ModalStep (discriminated union)

Define inside `src/modules/inbox/components/ManagedWhatsAppModal.tsx`:

```ts
export type ModalStep =
  | 'start'           // No row / draft / not_connected
  | 'business_form'   // collecting_business_info only (fresh entry via start step)
  | 'pending'         // pending_provider_review / provisioning / requested / pending_meta_action
  | 'action_required' // action_required — distinct screen: shows reason + pre-populated re-submit form
  | 'failed'          // failed / error / degraded
  | 'connected'       // truly connected (all 4 criteria satisfied)
  | 'disconnected';   // disconnected
```

> **Note**: `action_required` maps to its own `'action_required'` step (not `'business_form'`). Both steps render a business details form, but `action_required` additionally displays `status_reason_message` and pre-populates from `meta`. The `deriveModalStep()` function enforces this routing.

---

## 4. Step Derivation Function

Pure function — no side effects, no React hooks:

```ts
export function deriveModalStep(
  managedStatus: ManagedWhatsAppStatusResponse | null | undefined,
  isConnected: boolean,
): ModalStep {
  if (!managedStatus?.exists || managedStatus.status === 'draft' || managedStatus.status === 'not_connected') {
    return 'start';
  }
  if (isConnected) return 'connected';
  switch (managedStatus.status) {
    case 'collecting_business_info': return 'business_form';
    case 'pending_provider_review':
    case 'provisioning':
    case 'requested':
    case 'pending_meta_action':     return 'pending';
    case 'action_required':         return 'action_required';
    case 'failed':
    case 'error':
    case 'degraded':                return 'failed';
    case 'disconnected':            return 'disconnected';
    case 'connected':               return 'failed'; // connected without all 4 criteria = degraded
    default:                        return 'start';
  }
}
```

**Note**: `'connected'` state without `isConnected = true` (i.e., missing criteria) maps to `'failed'`
rather than `'connected'` screen. This ensures the four-criteria gate is visually enforced.

---

## 5. ManagedWhatsAppMeta Query (new API function)

```ts
// In src/modules/inbox/api/whatsappConnections.api.ts

export async function fetchManagedWhatsAppMeta(): Promise<ManagedWhatsAppMeta | null> {
  const { data, error } = await supabase
    .from('whatsapp_managed_connections')
    .select('meta')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.meta) return null;
  const m = data.meta as Record<string, unknown>;
  return {
    business_name:    typeof m.business_name === 'string'  ? m.business_name  : '',
    business_email:   typeof m.business_email === 'string' ? m.business_email : '',
    business_phone:   typeof m.business_phone === 'string' ? m.business_phone : '',
    meta_business_id: typeof m.meta_business_id === 'string' ? m.meta_business_id : null,
  };
}
```

---

## 6. Managed Disconnect (new API function)

```ts
// In src/modules/inbox/api/whatsappConnections.api.ts

export async function disconnectManagedWhatsApp(connectionId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('whatsapp_managed_connections')
    .update({ state: 'disconnected', disconnected_at: now, updated_at: now })
    .eq('id', connectionId);
  if (error) throw error;
}
```

---

## 7. New React Query Keys

Add to `whatsappConnectionKeys` in `useWhatsAppConnection.ts`:

```ts
export const whatsappConnectionKeys = {
  // ...existing keys...
  managedMeta: ['inbox', 'whatsapp-managed-meta'] as const,
};
```

---

## 8. New Hook: useManagedWhatsAppMeta

```ts
// In src/modules/inbox/hooks/useWhatsAppConnection.ts

export function useManagedWhatsAppMeta(enabled: boolean) {
  return useQuery({
    queryKey: whatsappConnectionKeys.managedMeta,
    queryFn: fetchManagedWhatsAppMeta,
    enabled,
  });
}
```

---

## 9. New Hook: useManagedWhatsAppDisconnect

```ts
// In src/modules/inbox/hooks/useWhatsAppConnection.ts

export function useManagedWhatsAppDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) => disconnectManagedWhatsApp(connectionId),
    onSuccess: () => {
      // Invalidate managed status + inbox conversations + thread summaries,
      // matching the pattern of the existing useWhatsAppDisconnect (manual).
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.managedStatus });
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
      invalidateInboxThreadSummaries(queryClient);
    },
  });
}
```

## 9b. Updated Hook: useManagedWhatsAppSubmitBusiness (existing — add managedMeta invalidation)

```ts
// In src/modules/inbox/hooks/useWhatsAppConnection.ts
// Update the existing onSuccess handler — additive change only.

export function useManagedWhatsAppSubmitBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ManagedSubmitBusinessParams) => submitManagedWhatsAppBusiness(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.managedStatus });
      // Invalidate meta cache so action_required re-entry always sees the latest submitted values.
      queryClient.invalidateQueries({ queryKey: whatsappConnectionKeys.managedMeta });
    },
  });
}
```

---

## 10. State Machine Diagram

```
[No row]
    │ "Connect via Managed WhatsApp"
    ▼
[collecting_business_info]  ◄─── restart from disconnected/failed
    │ submit business form
    ▼
[pending_provider_review]
    │                        │
    │ provider webhook        │ provider rejects → action_required
    ▼                        ▼
[connected ✓]         [action_required]
    │                        │ re-submit form
    │ disconnect              └──► [pending_provider_review]
    ▼
[disconnected]
    │ "Start new onboarding"
    └──► [collecting_business_info]

[failed / error / degraded]
    │ "Start Over"
    └──► [collecting_business_info]
```
