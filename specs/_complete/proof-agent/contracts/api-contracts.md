# API Contracts: Proof Agent Edge Functions

---

## proof-generate

**File**: `supabase/functions/proof-generate/index.ts`
**Auth**: User JWT (`Authorization: Bearer <token>`)
**Method**: POST
**CORS**: Standard `*` with `authorization, apikey, content-type, x-client-info`

### Request Body

```ts
{
  order_id: string;               // UUID — required
  inscription_text: string;       // required, non-empty
  stone_photo_url: string;        // required, non-empty URL (used as AI base image)
  font_style?: string | null;     // optional; e.g. "serif", "sans-serif", "script"
  additional_instructions?: string | null; // optional free text
}
```

### Response: 200 OK

```ts
{
  proof_id: string;
  render_url: string | null;      // signed URL (1 hr TTL) to the rendered PNG, or null if pending
  state: 'draft' | 'failed';
}
```

### Response: 409 Conflict

```ts
{ error: 'order_already_has_approved_proof' }
```

Returned when the order already has a proof with `state = 'approved'`. An approved proof cannot be overwritten.

### Response: 4xx / 5xx

```ts
{ error: string }
```

### Server Behaviour

1. Authenticate user via JWT.
2. Validate `order_id`, `inscription_text`, `stone_photo_url` are present.
3. Look up the order — verify it belongs to the authenticated user (via `user_id` on the proof or via orders RLS).
4. Reject if any existing proof for this order has `state = 'approved'` (return 409).
5. Upsert a proof row: if an existing row has `state IN ('failed', 'changes_requested', 'not_started')`, reset it; otherwise insert a new row. Set `state = 'generating'`.
6. Download `stone_photo_url` server-side.
7. Call OpenAI `images.edit` with the downloaded image + prompt.
8. On success: upload PNG to `proof-renders/{user_id}/{order_id}/{proof_id}.png` using service role key; update proof row to `state = 'draft'`, `render_url = storage_path`, `render_method = 'ai_image'`, `render_provider = 'openai'`, `render_meta = raw_openai_response`.
9. On failure: update proof row to `state = 'failed'`, `last_error = error_message`, `render_meta = raw_error`.
10. Return signed URL for immediate display.

### Env Vars Required

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (standard)
- `OPENAI_API_KEY` (new secret — must be set in Supabase project secrets)

---

## proof-send

**File**: `supabase/functions/proof-send/index.ts`
**Auth**: User JWT (`Authorization: Bearer <token>`)
**Method**: POST

### Request Body

```ts
{
  proof_id: string;              // UUID — required
  channels: ('email' | 'whatsapp')[];  // at least one — required
  customer_email?: string | null;      // required if 'email' in channels
  customer_phone?: string | null;      // required if 'whatsapp' in channels
  message_text?: string;              // optional; fallback: "Please review your memorial stone proof."
}
```

### Response: 200 OK

```ts
{
  proof_id: string;
  state: 'sent';
  sent_via: 'email' | 'whatsapp' | 'both';
  inbox_conversation_ids: string[];  // IDs of created/linked inbox_conversations rows
}
```

### Response: 409 Conflict

```ts
{ error: 'proof_not_in_draft_state'; current_state: string }
```

### Response: 4xx / 5xx

```ts
{ error: string }
```

### Server Behaviour

1. Authenticate user via JWT.
2. Load proof row; verify `user_id` matches; verify `state = 'draft'`. Return 409 if not.
3. Generate a signed URL for the `render_url` storage path (1 hr TTL).
4. For each requested channel:

   **Email** (`channels` includes `'email'`):
   - Require `customer_email`.
   - Load Gmail credentials from env vars.
   - Build multipart MIME email: text/plain body + the proof image as an attached PNG (`Content-Disposition: attachment`, `Content-Transfer-Encoding: base64`).
   - Send via Gmail API `messages.send` (new thread, no `threadId`).
   - Insert `inbox_conversations` row: `channel='email'`, `primary_handle=customer_email`, `user_id`, `subject='Proof for your memorial'`, `status='open'`, `link_state='unlinked'`.
   - Insert `inbox_messages` row: `direction='outbound'`, `from_handle=gmail_user`, `to_handle=customer_email`, `body_text=message_text`, `meta={ proof_id, gmail: { messageId, threadId } }`.
   - Attempt `attemptAutoLink` using the `autoLinkConversation` shared helper.

   **WhatsApp** (`channels` includes `'whatsapp'`):
   - Require `customer_phone`.
   - Resolve Twilio credentials via `whatsappRoutingResolver` (existing shared helper).
   - Call Twilio Messages API with `Body=message_text`, `MediaUrl=[signed_render_url]`, `From=whatsapp_sender`, `To=whatsapp:{customer_phone}`.
   - Insert `inbox_conversations` row: `channel='whatsapp'`, `primary_handle=customer_phone`, `user_id`, `status='open'`.
   - Insert `inbox_messages` row: `direction='outbound'`, `body_text=message_text`, `meta={ proof_id, twilio: { sid } }`.
   - Attempt `attemptAutoLink`.

5. Update proof row: `state='sent'`, `sent_via=('email'|'whatsapp'|'both')`, `sent_at=now()`, `inbox_conversation_id=first_created_conversation_id`.
6. Return response.

### Env Vars Required

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_USER_EMAIL` (existing)
- Twilio credentials resolved via `whatsappRoutingResolver` (existing shared helper using stored encrypted credentials)

---

## proof-approve (no Edge Function — direct client update)

State transition: `sent → approved`

```ts
// Frontend: proofs.api.ts
await supabase
  .from('order_proofs')
  .update({
    state: 'approved',
    approved_at: new Date().toISOString(),
    approved_by: 'staff_manual',
  })
  .eq('id', proofId)
  .eq('state', 'sent');   // Optimistic state guard on the DB update itself
```

The `.eq('state', 'sent')` guard means the update is a no-op if the state has changed concurrently. The frontend hook checks `data.length === 0` to detect this and surfaces an error.

---

## proof-request-changes (no Edge Function — direct client update)

State transition: `sent → changes_requested`

```ts
await supabase
  .from('order_proofs')
  .update({
    state: 'changes_requested',
    changes_requested_at: new Date().toISOString(),
    changes_note: changesNote,
  })
  .eq('id', proofId)
  .eq('state', 'sent');
```
