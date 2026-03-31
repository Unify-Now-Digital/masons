# Data Model: Proof Agent

---

## 1. New Database Table: order_proofs

```sql
create table if not exists public.order_proofs (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders(id) on delete cascade,
  user_id                 uuid not null references auth.users(id) on delete cascade,

  -- Generation inputs
  inscription_text        text not null,
  stone_photo_url         text not null,
  font_style              text,
  additional_instructions text,

  -- Render outputs
  render_url              text,
  render_method           text not null default 'ai_image'
                            check (render_method in ('ai_image', 'canvas_composite', 'manual_upload')),
  render_provider         text,
  render_meta             jsonb,

  -- Lifecycle state
  state                   text not null default 'not_started'
                            check (state in (
                              'not_started',
                              'generating',
                              'draft',
                              'sent',
                              'approved',
                              'changes_requested',
                              'failed'
                            )),
  last_error              text,

  -- Send tracking
  sent_via                text check (sent_via in ('email', 'whatsapp', 'both')),
  sent_at                 timestamptz,
  inbox_conversation_id   uuid references public.inbox_conversations(id) on delete set null,

  -- Approval
  approved_at             timestamptz,
  approved_by             text check (approved_by in ('staff_manual', 'customer_email', 'customer_whatsapp')),

  -- Change request
  changes_requested_at    timestamptz,
  changes_note            text,

  -- Audit
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Indexes
create index if not exists idx_order_proofs_order_id on public.order_proofs (order_id);
create index if not exists idx_order_proofs_user_id  on public.order_proofs (user_id);
create index if not exists idx_order_proofs_state    on public.order_proofs (state);

-- updated_at trigger (reuses existing function)
create trigger update_order_proofs_updated_at
  before update on public.order_proofs
  for each row
  execute function public.update_updated_at_column();

-- RLS
alter table public.order_proofs enable row level security;

create policy "Users can select own order_proofs"
  on public.order_proofs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can insert own order_proofs"
  on public.order_proofs for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update own order_proofs"
  on public.order_proofs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

---

## 2. Storage Bucket: proof-renders

SQL to create the private bucket and a signed-URL-only storage policy:

```sql
-- Insert bucket (idempotent via on conflict)
insert into storage.buckets (id, name, public)
values ('proof-renders', 'proof-renders', false)
on conflict (id) do nothing;

-- Storage RLS: authenticated users can read/write their own path prefix
create policy "Users can upload own proof renders"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'proof-renders'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can read own proof renders"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'proof-renders'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "Users can delete own proof renders"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'proof-renders'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
```

---

## 3. Frontend Types

### OrderProof (frontend type)

```ts
// src/modules/proofs/types/proofs.types.ts

export type ProofState =
  | 'not_started'
  | 'generating'
  | 'draft'
  | 'sent'
  | 'approved'
  | 'changes_requested'
  | 'failed';

export type ProofRenderMethod = 'ai_image' | 'canvas_composite' | 'manual_upload';
export type ProofSentVia = 'email' | 'whatsapp' | 'both';
export type ProofApprovedBy = 'staff_manual' | 'customer_email' | 'customer_whatsapp';

export interface OrderProof {
  id: string;
  order_id: string;
  user_id: string;
  inscription_text: string;
  stone_photo_url: string;
  font_style: string | null;
  additional_instructions: string | null;
  render_url: string | null;
  render_method: ProofRenderMethod;
  render_provider: string | null;
  render_meta: Record<string, unknown> | null;
  state: ProofState;
  last_error: string | null;
  sent_via: ProofSentVia | null;
  sent_at: string | null;
  inbox_conversation_id: string | null;
  approved_at: string | null;
  approved_by: ProofApprovedBy | null;
  changes_requested_at: string | null;
  changes_note: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderProofInsert = Pick<
  OrderProof,
  'order_id' | 'user_id' | 'inscription_text' | 'stone_photo_url' | 'font_style' | 'additional_instructions'
>;
```

### ProofGenerateRequest (Edge Function request body)

```ts
// Used by proofs.api.ts when calling proof-generate

export interface ProofGenerateRequest {
  order_id: string;
  inscription_text: string;
  stone_photo_url: string;
  font_style?: string | null;
  additional_instructions?: string | null;
}

export interface ProofGenerateResponse {
  proof_id: string;
  render_url: string | null;
  state: ProofState;
  error?: string;
}
```

### ProofSendRequest (Edge Function request body)

```ts
export interface ProofSendRequest {
  proof_id: string;
  channels: ('email' | 'whatsapp')[];
  customer_email?: string | null;
  customer_phone?: string | null;
  message_text?: string;
}

export interface ProofSendResponse {
  proof_id: string;
  state: ProofState;
  sent_via: ProofSentVia;
  inbox_conversation_ids: string[];
}
```

---

## 4. State Machine

```
[not_started]
      │ staff triggers ProofGenerateForm
      ▼
[generating] ──── AI/upload succeeds ────► [draft]
      │                                       │
      └── AI fails ──► [failed]               │ staff reviews → sends
                           │                  ▼
                   staff retries       [sent]
                   (form reopen)          │             │
                                 customer │             │ staff records change request
                                 approves │             ▼
                                (manual)  │     [changes_requested]
                                          │             │
                                          ▼             │ staff regenerates
                                     [approved]         ▼
                                          │        [generating]
                                          │              │
                                   JOB START            ▼
                                    UNLOCKED          [draft] ──► send cycle repeats
```

---

## 5. React Query Key Conventions

```ts
// src/modules/proofs/hooks/useProofs.ts

export const proofKeys = {
  all: ['order_proofs'] as const,
  byOrder: (orderId: string) => ['order_proofs', 'order', orderId] as const,
  detail: (proofId: string) => ['order_proofs', proofId] as const,
};
```

---

## 6. Proof State Helpers (shared utility)

```ts
// src/modules/proofs/utils/proofState.ts

export function isProofApproved(proof: OrderProof | null | undefined): boolean {
  return proof?.state === 'approved';
}

export function canSendProof(proof: OrderProof | null | undefined): boolean {
  return proof?.state === 'draft';
}

export function canApproveProof(proof: OrderProof | null | undefined): boolean {
  return proof?.state === 'sent';
}

export function canRequestChanges(proof: OrderProof | null | undefined): boolean {
  return proof?.state === 'sent';
}

export function canRegenerateProof(proof: OrderProof | null | undefined): boolean {
  return (
    proof?.state === 'failed' ||
    proof?.state === 'changes_requested' ||
    proof?.state === 'draft'
  );
}
```
