# Replace DB-only Inbox "Send Reply" with Twilio Outbound Sending via Supabase Edge Function

## Overview

**Goal:** Replace the current DB-only "Send Reply" implementation in the Unified Inbox with real Twilio outbound SMS/WhatsApp sending via a Supabase Edge Function. The Edge Function will handle Twilio API calls, message insertion, and conversation metadata updates.

**Context:**
- Current implementation (`useSendReply` hook) directly inserts into `inbox_messages` and updates `inbox_conversations` (DB-only, no actual sending)
- Need to integrate with Twilio API for real message delivery
- Edge Function provides secure server-side Twilio API key management
- Frontend will call Edge Function instead of direct DB operations

**Scope:**
- Create Supabase Edge Function `inbox-twilio-send` for Twilio outbound sending
- Add frontend environment variables for Edge Function URL and admin token
- Create API helper function to call Edge Function
- Update `useSendReply` mutation to use Edge Function instead of direct DB operations
- Maintain existing UI behavior (textarea clearing, button states, error handling)
- No database schema changes
- No changes to legacy `messages` table

---

## Current State Analysis

### Current Send Reply Implementation

**File:** `src/modules/inbox/hooks/useInboxMessages.ts`

**Current Flow:**
1. Validates `bodyText` (trim, reject empty)
2. Fetches conversation to get `channel` and `primary_handle`
3. Inserts message into `inbox_messages`:
   - `conversation_id`, `channel`, `direction='outbound'`
   - `from_handle='team'`, `to_handle=conversation.primary_handle`
   - `body_text`, `sent_at=now()`, `status='sent'`
4. Updates `inbox_conversations`:
   - `last_message_at=sent_at`
   - `last_message_preview=body_text.substring(0, 120)`
   - Does NOT modify `unread_count`
5. Invalidates React Query caches

**Observations:**
- No actual message delivery (DB-only placeholder)
- `status='sent'` is misleading (message not actually sent)
- `from_handle='team'` is hardcoded placeholder
- No error handling for Twilio API failures
- No delivery status tracking

### Edge Function Pattern

**Existing Edge Functions:**
- `supabase/functions/gmail-sync/index.ts` - Gmail sync function
- `supabase/functions/gmail-oauth/index.ts` - Gmail OAuth function

**Pattern:**
- Use `Deno.serve()` (not deprecated `serve` from std)
- Import Supabase client: `npm:@supabase/supabase-js@2.x.x`
- CORS headers for cross-origin requests
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (pre-populated)
- Custom secrets: Set via `supabase secrets set`

**Frontend Invocation:**
- Use `supabase.functions.invoke('function-name', { body: {...} })`
- Or direct `fetch()` to `https://<PROJECT_REF>.supabase.co/functions/v1/function-name`

---

## Implementation Approach

### Phase 1: Environment Variables & Configuration

**Goal:** Add frontend environment variables for Edge Function URL and admin token.

**Tasks:**
1. Add to `.env.example`:
   ```
   VITE_SUPABASE_FUNCTIONS_URL=https://<PROJECT_REF>.supabase.co/functions/v1
   VITE_INBOX_ADMIN_TOKEN=<admin-token-value>
   ```

2. Update `.env` (local development):
   - Set `VITE_SUPABASE_FUNCTIONS_URL` to local or production URL
   - Set `VITE_INBOX_ADMIN_TOKEN` to match Supabase secret `INBOX_ADMIN_TOKEN`

3. Document in README or env docs:
   - `VITE_SUPABASE_FUNCTIONS_URL`: Base URL for Supabase Edge Functions
   - `VITE_INBOX_ADMIN_TOKEN`: Admin token for authenticating Edge Function requests (must match `INBOX_ADMIN_TOKEN` secret)

**Success Criteria:**
- ✅ Environment variables added to `.env.example`
- ✅ Variables documented
- ✅ No breaking changes to existing env vars

---

### Phase 2: Create Supabase Edge Function

**Goal:** Create `inbox-twilio-send` Edge Function that handles Twilio outbound sending.

**File:** `supabase/functions/inbox-twilio-send/index.ts` (new file)

**Implementation:**

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
};

interface SendMessageRequest {
  conversation_id: string;
  body_text: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin token
    const adminToken = req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');
    
    if (!adminToken || adminToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { conversation_id, body_text }: SendMessageRequest = await req.json();

    if (!conversation_id || !body_text?.trim()) {
      return new Response(
        JSON.stringify({ error: 'conversation_id and body_text are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch conversation
    const { data: conversation, error: convError } = await supabaseClient
      .from('inbox_conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: 'Conversation not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Twilio credentials from secrets
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine Twilio API endpoint based on channel
    let twilioUrl: string;
    if (conversation.channel === 'whatsapp') {
      twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    } else {
      // SMS
      twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    }

    // Prepare Twilio request
    const toNumber = conversation.primary_handle; // Should be phone number format
    const fromNumber = conversation.channel === 'whatsapp' 
      ? `whatsapp:${twilioPhoneNumber}`
      : twilioPhoneNumber;
    const toNumberFormatted = conversation.channel === 'whatsapp'
      ? `whatsapp:${toNumber}`
      : toNumber;

    const twilioBody = new URLSearchParams({
      From: fromNumber,
      To: toNumberFormatted,
      Body: body_text.trim(),
    });

    // Send via Twilio API
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: twilioBody.toString(),
    });

    if (!twilioResponse.ok) {
      const twilioError = await twilioResponse.text();
      console.error('Twilio API error:', twilioError);
      
      // Insert message with status='failed'
      const sentAt = new Date().toISOString();
      await supabaseClient.from('inbox_messages').insert({
        conversation_id,
        channel: conversation.channel,
        direction: 'outbound',
        from_handle: 'team',
        to_handle: conversation.primary_handle,
        body_text: body_text.trim(),
        subject: null,
        sent_at: sentAt,
        status: 'failed',
      });

      return new Response(
        JSON.stringify({ error: 'Failed to send message via Twilio', details: twilioError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const twilioData = await twilioResponse.json();

    // Insert message with status='sent' (or 'delivered' if Twilio provides delivery status)
    const sentAt = new Date().toISOString();
    const { data: message, error: msgError } = await supabaseClient
      .from('inbox_messages')
      .insert({
        conversation_id,
        channel: conversation.channel,
        direction: 'outbound',
        from_handle: 'team',
        to_handle: conversation.primary_handle,
        body_text: body_text.trim(),
        subject: null,
        sent_at: sentAt,
        status: 'sent', // Twilio will update via webhook later if configured
      })
      .select()
      .single();

    if (msgError) {
      console.error('Failed to insert message:', msgError);
      return new Response(
        JSON.stringify({ error: 'Failed to save message', details: msgError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update conversation metadata
    await supabaseClient
      .from('inbox_conversations')
      .update({
        last_message_at: sentAt,
        last_message_preview: body_text.trim().substring(0, 120),
        updated_at: new Date().toISOString(),
        // DO NOT modify unread_count (outbound messages don't count as unread)
      })
      .eq('id', conversation_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: message.id,
        twilio_sid: twilioData.sid 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('Edge function error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
```

**Edge Function Secrets Required:**
- `INBOX_ADMIN_TOKEN` - Admin token for authenticating requests
- `TWILIO_ACCOUNT_SID` - Twilio account SID
- `TWILIO_AUTH_TOKEN` - Twilio auth token
- `TWILIO_PHONE_NUMBER` - Twilio phone number (for SMS/WhatsApp)

**Success Criteria:**
- ✅ Edge Function created at `supabase/functions/inbox-twilio-send/index.ts`
- ✅ Handles CORS preflight
- ✅ Validates admin token
- ✅ Fetches conversation from DB
- ✅ Calls Twilio API (SMS/WhatsApp)
- ✅ Inserts message into `inbox_messages`
- ✅ Updates `inbox_conversations` metadata
- ✅ Returns success/error response
- ✅ Handles Twilio API failures gracefully

---

### Phase 3: Create Frontend API Helper

**Goal:** Create API helper function to call Edge Function.

**File:** `src/modules/inbox/api/inboxTwilio.api.ts` (new file)

**Implementation:**

```typescript
interface SendTwilioMessageRequest {
  conversation_id: string;
  body_text: string;
}

interface SendTwilioMessageResponse {
  success: boolean;
  message_id?: string;
  twilio_sid?: string;
  error?: string;
  details?: string;
}

export async function sendTwilioMessage(request: SendTwilioMessageRequest): Promise<SendTwilioMessageResponse> {
  const functionsUrl = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  const adminToken = import.meta.env.VITE_INBOX_ADMIN_TOKEN;

  if (!functionsUrl || !adminToken) {
    throw new Error('Edge Function URL or admin token not configured');
  }

  const response = await fetch(`${functionsUrl}/inbox-twilio-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Failed to send message: ${response.statusText}`);
  }

  return data as SendTwilioMessageResponse;
}
```

**Success Criteria:**
- ✅ API helper function created
- ✅ Reads env vars (`VITE_SUPABASE_FUNCTIONS_URL`, `VITE_INBOX_ADMIN_TOKEN`)
- ✅ POSTs to Edge Function with `X-Admin-Token` header
- ✅ Handles errors and throws appropriately
- ✅ Returns typed response

---

### Phase 4: Update Send Reply Hook

**Goal:** Update `useSendReply` to call Edge Function instead of direct DB operations.

**File:** `src/modules/inbox/hooks/useInboxMessages.ts`

**Implementation:**

Replace current `useSendReply` implementation:

```typescript
import { sendTwilioMessage } from '../api/inboxTwilio.api';

export function useSendReply() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, bodyText }: { conversationId: string; bodyText: string }) => {
      // Validate body text (trim, reject empty)
      const trimmedBodyText = bodyText.trim();
      if (!trimmedBodyText) {
        throw new Error('Message body cannot be empty');
      }

      // Call Edge Function to send via Twilio
      const result = await sendTwilioMessage({
        conversation_id: conversationId,
        body_text: trimmedBodyText,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send message');
      }

      return result;
    },
    onSuccess: (data, variables) => {
      // Invalidate message thread
      queryClient.invalidateQueries({ queryKey: inboxKeys.messages.byConversation(variables.conversationId) });
      // Invalidate conversation list (to update last_message_*)
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.all });
      // Invalidate conversation detail
      queryClient.invalidateQueries({ queryKey: inboxKeys.conversations.detail(variables.conversationId) });
    },
  });
}
```

**Success Criteria:**
- ✅ `useSendReply` calls `sendTwilioMessage` instead of direct DB operations
- ✅ Validation still occurs (trim, reject empty)
- ✅ React Query cache invalidation unchanged
- ✅ Error handling preserved
- ✅ No breaking changes to component usage

---

### Phase 5: UI Error Handling & Loading States

**Goal:** Ensure UI properly handles loading states and errors from Edge Function.

**File:** `src/modules/inbox/components/ConversationView.tsx`

**Current Implementation:**
- Already has `sendReplyMutation.isPending` check for button disable
- Already clears textarea on success
- May need error display enhancement

**Updates Needed:**
1. Add error toast/alert if mutation fails:
   ```typescript
   const handleSendReply = () => {
     if (!conversationId || !replyText.trim()) return;

     sendReplyMutation.mutate(
       { conversationId, bodyText: replyText },
       {
         onSuccess: () => {
           setReplyText(''); // Clear textarea
         },
         onError: (error) => {
           // Show error toast/alert
           console.error('Failed to send reply:', error);
           // TODO: Add toast notification
         },
       }
     );
   };
   ```

2. Ensure button disabled state:
   ```typescript
   disabled={!replyText.trim() || sendReplyMutation.isPending}
   ```

**Success Criteria:**
- ✅ Send button disabled while pending
- ✅ Textarea clears after success
- ✅ Error displayed on failure (toast/alert)
- ✅ Loading state shown ("Sending..." text)

---

## Safety Considerations

### Security
- **Admin Token:** Must match between frontend env var and Supabase secret
- **Token Validation:** Edge Function validates `X-Admin-Token` header
- **Twilio Credentials:** Stored only in Supabase secrets (never in frontend)
- **CORS:** Edge Function allows cross-origin requests (may need to restrict in production)

### Error Handling
- **Twilio API Failures:** Message inserted with `status='failed'`, error returned to frontend
- **DB Failures:** Error returned, no partial state
- **Network Failures:** Frontend mutation error, user can retry
- **Invalid Conversation:** Edge Function returns 404, frontend handles gracefully

### Data Integrity
- **Message Insertion:** Always happens (even on Twilio failure) for audit trail
- **Conversation Update:** Only updates `last_message_at` and `preview` (not `unread_count`)
- **Status Tracking:** `status='sent'` on success, `status='failed'` on Twilio error

---

## What NOT to Do

- ❌ **Do NOT expose Twilio credentials in frontend** - Keep in Supabase secrets only
- ❌ **Do NOT change database schema** - No migrations needed
- ❌ **Do NOT modify legacy `messages` table** - Out of scope
- ❌ **Do NOT change UI layout/styling** - Keep existing design
- ❌ **Do NOT implement Twilio webhooks** - Out of scope (delivery status updates)
- ❌ **Do NOT add retry logic** - Simple error handling only
- ❌ **Do NOT change conversation metadata update logic** - Keep existing behavior

---

## Open Questions / Considerations

1. **Twilio Phone Number Format:** Should `primary_handle` be validated as phone number? Decision: Assume valid phone format for now, add validation later if needed.

2. **WhatsApp vs SMS:** Both use same Twilio Messages API, but `From`/`To` format differs (`whatsapp:+...`). Decision: Handle in Edge Function based on `conversation.channel`.

3. **Error Display:** Should errors be shown as toast, inline alert, or both? Decision: Start with console.error, add toast later if needed.

4. **Delivery Status:** Twilio webhooks can update `status` to `'delivered'` or `'failed'`. Decision: Out of scope for v1, keep `status='sent'` initially.

5. **Admin Token Rotation:** How to handle token rotation? Decision: Update both env var and Supabase secret simultaneously.

6. **Local Development:** How to test Edge Function locally? Decision: Use `supabase functions serve` and point `VITE_SUPABASE_FUNCTIONS_URL` to `http://localhost:54321/functions/v1`.

---

## Acceptance Criteria

✅ **Environment Variables:**
- `VITE_SUPABASE_FUNCTIONS_URL` added to `.env.example`
- `VITE_INBOX_ADMIN_TOKEN` added to `.env.example`
- Variables documented

✅ **Edge Function:**
- Created at `supabase/functions/inbox-twilio-send/index.ts`
- Validates admin token
- Fetches conversation from DB
- Calls Twilio API (SMS/WhatsApp)
- Inserts message into `inbox_messages`
- Updates `inbox_conversations` metadata
- Returns success/error response

✅ **Frontend API Helper:**
- Created `sendTwilioMessage()` function
- Reads env vars correctly
- POSTs to Edge Function with `X-Admin-Token` header
- Handles errors appropriately

✅ **Send Reply Hook:**
- Calls Edge Function instead of direct DB operations
- Validation preserved (trim, reject empty)
- Cache invalidation unchanged
- Error handling preserved

✅ **UI Behavior:**
- Send button disabled while pending
- Textarea clears after success
- Error displayed on failure
- Loading state shown

✅ **No Breaking Changes:**
- Database schema unchanged
- Legacy `messages` table untouched
- UI layout/styling unchanged
- Existing functionality preserved

---

## Deliverables

1. **Environment Variables:**
   - Updated `.env.example` with new vars
   - Documentation for env vars

2. **Edge Function:**
   - `supabase/functions/inbox-twilio-send/index.ts`
   - Handles Twilio SMS/WhatsApp sending
   - Inserts message and updates conversation

3. **Frontend API:**
   - `src/modules/inbox/api/inboxTwilio.api.ts`
   - `sendTwilioMessage()` helper function

4. **Updated Hook:**
   - `src/modules/inbox/hooks/useInboxMessages.ts`
   - `useSendReply()` updated to use Edge Function

5. **UI Updates (if needed):**
   - `src/modules/inbox/components/ConversationView.tsx`
   - Error handling enhancements

---

**Specification Version:** 1.0  
**Created:** 2025-01-11  
**Status:** Ready for Implementation
