# Data Model: Customer Linked Contacts

---

## 1. LinkedContact (frontend-only type)

```ts
// src/modules/customers/hooks/useLinkedContacts.ts

export interface LinkedContact {
  channel: 'email' | 'sms' | 'whatsapp';
  handle: string;   // primary_handle value from inbox_conversations
}
```

No DB changes. Derived from `inbox_conversations` at query time.

---

## 2. useLinkedContactsByCustomer hook

```ts
// src/modules/customers/hooks/useLinkedContacts.ts

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import type { LinkedContact } from './useLinkedContacts';

export const linkedContactsKeys = {
  byCustomer: (customerId: string) =>
    ['customers', 'linked-contacts', customerId] as const,
};

async function fetchLinkedContacts(customerId: string): Promise<LinkedContact[]> {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .select('channel, primary_handle')
    .eq('person_id', customerId)
    .eq('link_state', 'linked');

  if (error) throw error;

  // Deduplicate by (channel, normalised handle)
  const seen = new Set<string>();
  const result: LinkedContact[] = [];
  for (const row of data ?? []) {
    const key = `${row.channel}:${row.primary_handle.trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ channel: row.channel as LinkedContact['channel'], handle: row.primary_handle.trim() });
    }
  }
  return result;
}

export function useLinkedContactsByCustomer(customerId: string | null | undefined) {
  return useQuery({
    queryKey: linkedContactsKeys.byCustomer(customerId ?? ''),
    queryFn: () => fetchLinkedContacts(customerId!),
    enabled: !!customerId,
  });
}
```

---

## 3. Contact option sets (ProofSendModal internal logic)

```ts
// Derived inside ProofSendModal from two data sources:
// 1. linkedContacts = useLinkedContactsByCustomer(customerId)
// 2. customer = useCustomer(customerId)

function buildEmailOptions(
  linkedContacts: LinkedContact[],
  staticEmail: string | null | undefined,
): string[] {
  const set = new Set<string>();
  if (staticEmail?.trim()) set.add(staticEmail.trim().toLowerCase());
  linkedContacts
    .filter((c) => c.channel === 'email')
    .forEach((c) => set.add(c.handle.toLowerCase()));
  // Preserve stable display order: static first, then linked
  const opts: string[] = [];
  if (staticEmail?.trim()) opts.push(staticEmail.trim());
  linkedContacts
    .filter((c) => c.channel === 'email')
    .forEach((c) => { if (!opts.map(o => o.toLowerCase()).includes(c.handle.toLowerCase())) opts.push(c.handle); });
  return opts;
}

function buildPhoneOptions(
  linkedContacts: LinkedContact[],
  staticPhone: string | null | undefined,
): { handle: string; channel: 'sms' | 'whatsapp' | 'static' }[] {
  const opts: { handle: string; channel: 'sms' | 'whatsapp' | 'static' }[] = [];
  const seen = new Set<string>();
  if (staticPhone?.trim()) {
    seen.add(staticPhone.trim().toLowerCase());
    opts.push({ handle: staticPhone.trim(), channel: 'static' });
  }
  linkedContacts
    .filter((c) => c.channel === 'sms' || c.channel === 'whatsapp')
    .forEach((c) => {
      const key = c.handle.toLowerCase();
      if (!seen.has(key)) { seen.add(key); opts.push({ handle: c.handle, channel: c.channel }); }
    });
  return opts;
}
```

---

## 4. Prop signature changes

### ProofPanelProps — before → after

```ts
// Before:
interface ProofPanelProps {
  orderId: string;
  initialInscriptionText?: string | null;
  initialStonePhotoUrl?: string | null;
  initialFontStyle?: string | null;
  customerEmail?: string | null;    // REMOVE
  customerPhone?: string | null;    // REMOVE
}

// After:
interface ProofPanelProps {
  orderId: string;
  initialInscriptionText?: string | null;
  initialStonePhotoUrl?: string | null;
  initialFontStyle?: string | null;
  customerId?: string | null;       // ADD — passed to ProofSendModal
}
```

### ProofSendModalProps — before → after

```ts
// Before:
interface ProofSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proof: OrderProof;
  renderUrl: string | null;
  customerEmail?: string | null;    // REMOVE
  customerPhone?: string | null;    // REMOVE
  onSuccess?: () => void;
}

// After:
interface ProofSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proof: OrderProof;
  renderUrl: string | null;
  customerId?: string | null;       // ADD — fetches contacts internally
  onSuccess?: () => void;
}
```

### OrderDetailsSidebar — ProofPanel call

```tsx
// Before:
<ProofPanel
  orderId={order.id}
  initialInscriptionText={order.inscription_text ?? null}
  initialStonePhotoUrl={order.product_photo_url ?? null}
  initialFontStyle={order.inscription_font ?? null}
  customerEmail={proofCustomerEmail}       // REMOVE
  customerPhone={proofCustomerPhone}       // REMOVE
/>

// After:
<ProofPanel
  orderId={order.id}
  initialInscriptionText={order.inscription_text ?? null}
  initialStonePhotoUrl={order.product_photo_url ?? null}
  initialFontStyle={order.inscription_font ?? null}
  customerId={order.person_id ?? null}    // ADD
/>

// And remove from component body:
// - const { data: orderPeople } = useOrderPeople(order?.id ?? null);
// - const primaryPerson = ...
// - const proofCustomerEmail = ...
// - const proofCustomerPhone = ...
// - import useOrderPeople (if no longer used elsewhere in the file)
```

---

## 5. Query key conventions

```ts
linkedContactsKeys.byCustomer(customerId) = ['customers', 'linked-contacts', customerId]
```

Invalidation: no mutations on this data from this feature (links/unlinks happen in Inbox and would invalidate via `inboxKeys`). No explicit invalidation needed here for MVP.

---

## 6. Channel label helper

```ts
function channelLabel(channel: 'email' | 'sms' | 'whatsapp' | 'static'): string {
  switch (channel) {
    case 'email':    return 'Email';
    case 'sms':      return 'SMS';
    case 'whatsapp': return 'WhatsApp';
    case 'static':   return 'Primary';
  }
}
```
