import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-admin-token',
};

interface SyncRequest {
  since?: string; // ISO timestamp
  maxMessages?: number; // default 50, max 100
}

interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId?: string }>;
  nextPageToken?: string;
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet: string;
  internalDate: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{
        mimeType?: string;
        body?: { data?: string };
      }>;
    }>;
  };
}

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    // Validate admin token
    const adminToken = req.headers.get('x-admin-token') ?? req.headers.get('X-Admin-Token');
    const expectedToken = Deno.env.get('INBOX_ADMIN_TOKEN');

    if (!expectedToken || !adminToken || adminToken !== expectedToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Parse request body
    const body: SyncRequest = await req.json().catch(() => ({}));
    const maxMessages = Math.min(Math.max(body.maxMessages || 50, 1), 100);

    // Load Gmail secrets
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    const refreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
    const userEmail = Deno.env.get('GMAIL_USER_EMAIL');

    if (!clientId || !clientSecret || !refreshToken || !userEmail) {
      console.error('Gmail credentials missing');
      return new Response(
        JSON.stringify({ error: 'Gmail not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Get access token via refresh token
    const tokenBody = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId.trim(),
      client_secret: clientSecret.trim(),
      refresh_token: refreshToken.trim(),
    }).toString();

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Gmail OAuth error', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorText,
        clientIdSuffix: clientId.slice(-8), // safe
        refreshTokenPrefix: refreshToken.slice(0, 6), // safe (optional)
      });
      return new Response(JSON.stringify({ error: 'Failed to authenticate with Gmail' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData = await tokenResponse.json() as { access_token: string };
    const accessToken = tokenData.access_token;

    // Build query for messages.list
    const queryParams = new URLSearchParams({
      labelIds: 'INBOX',
      maxResults: maxMessages.toString(),
    });

    if (body.since) {
      // Convert ISO date to Unix timestamp for Gmail query
      const sinceDate = new Date(body.since);
      const unixTimestamp = Math.floor(sinceDate.getTime() / 1000);
      queryParams.set('q', `after:${unixTimestamp}`);
    }

    // Fetch message list
    const messagesListResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${queryParams.toString()}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!messagesListResponse.ok) {
      const errorText = await messagesListResponse.text();
      console.error('Gmail messages.list error', {
        status: messagesListResponse.status,
        statusText: messagesListResponse.statusText,
        errorText,
      });
      return new Response(
        JSON.stringify({ error: 'Failed to fetch Gmail messages' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const messagesList = await messagesListResponse.json() as GmailMessageListResponse;
    const messageIds = messagesList.messages || [];

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Supabase URL or SERVICE_ROLE_KEY missing');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let syncedCount = 0;
    let skippedCount = 0;
    let errorsCount = 0;

    // Process each message
    for (const { id: messageId } of messageIds) {
      try {
        // Fetch full message
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        if (!messageResponse.ok) {
          console.error(`Failed to fetch message ${messageId}`);
          errorsCount++;
          continue;
        }

        const message = await messageResponse.json() as GmailMessageResponse;

        // Extract headers
        const headers = message.payload.headers;
        const getHeader = (name: string) => headers.find((h) => h.name === name)?.value || '';

        const fromHeader = getHeader('From');
        const toHeader = getHeader('To');
        const subjectHeader = getHeader('Subject');
        const dateHeader = getHeader('Date');

        // Parse email addresses
        const extractEmail = (header: string): string => {
          const match = header.match(/<(.+?)>/);
          return match ? match[1] : header.trim();
        };

        const fromEmail = extractEmail(fromHeader);
        const toEmail = extractEmail(toHeader);
        const subject = subjectHeader || '(no subject)';

        // Determine direction and primary handle
        const direction = fromEmail === userEmail ? 'outbound' : 'inbound';
        const primaryHandle = direction === 'inbound' ? fromEmail : toEmail;

        // Parse sentAt
        let sentAt: string;
        try {
          const date = new Date(dateHeader);
          if (!isNaN(date.getTime())) {
            sentAt = date.toISOString();
          } else {
            throw new Error('Invalid date');
          }
        } catch {
          // Fallback to internalDate
          try {
            sentAt = new Date(parseInt(message.internalDate)).toISOString();
          } catch {
            sentAt = new Date().toISOString();
          }
        }

        // Extract body text
        const extractBodyText = (payload: GmailMessageResponse['payload']): string => {
          if (payload.body?.data) {
            try {
              return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } catch {
              // Ignore decode errors
            }
          }
          if (payload.parts) {
            for (const part of payload.parts) {
              if (part.mimeType === 'text/plain' && part.body?.data) {
                try {
                  return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                } catch {
                  // Continue
                }
              }
              if (part.parts) {
                for (const nestedPart of part.parts) {
                  if (nestedPart.mimeType === 'text/plain' && nestedPart.body?.data) {
                    try {
                      return atob(nestedPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                    } catch {
                      // Continue
                    }
                  }
                }
              }
            }
          }
          return '';
        };

        let bodyText = extractBodyText(message.payload);
        if (!bodyText) bodyText = message.snippet || '';

        // Find or create conversation based on Gmail threadId (by scanning recent messages)
        let conversationId: string;

        const { data: recentMessages } = await supabase
          .from('inbox_messages')
          .select('conversation_id, meta')
          .eq('channel', 'email')
          .limit(1000);

        let existingConversationId: string | null = null;
        if (recentMessages) {
          for (const msg of recentMessages) {
            const meta = msg.meta as { gmail?: { threadId?: string } } | null;
            if (meta?.gmail?.threadId === message.threadId) {
              existingConversationId = msg.conversation_id;
              break;
            }
          }
        }

        if (existingConversationId) {
          conversationId = existingConversationId;
        } else {
          const { data: newConversation, error: convError } = await supabase
            .from('inbox_conversations')
            .insert({
              channel: 'email',
              primary_handle: primaryHandle,
              subject: subject,
              status: 'open',
              unread_count: direction === 'inbound' ? 1 : 0,
              last_message_at: sentAt,
              last_message_preview: bodyText.slice(0, 120),
            })
            .select('id')
            .single();

          if (convError || !newConversation) {
            console.error('Failed to create conversation', convError);
            errorsCount++;
            continue;
          }

          conversationId = newConversation.id;
        }

        // Auto-link conversation to People (customers) by strict email match
        try {
          await attemptAutoLink(supabase, conversationId, "email", primaryHandle);
        } catch (e) {
          console.error("inbox-gmail-sync: auto-link failed", e);
        }

        // Check for duplicate message
        const { data: recentMsgs } = await supabase
          .from('inbox_messages')
          .select('id, meta')
          .eq('channel', 'email')
          .limit(1000);

        const existingMsg = recentMsgs?.find((msg) => {
          const meta = msg.meta as { gmail?: { messageId?: string } } | null;
          return meta?.gmail?.messageId === message.id;
        });

        if (existingMsg) {
          skippedCount++;
          continue;
        }

        // Insert message
        const { error: insertError } = await supabase
          .from('inbox_messages')
          .insert({
            conversation_id: conversationId,
            channel: 'email',
            direction,
            from_handle: fromEmail,
            to_handle: toEmail,
            body_text: bodyText,
            sent_at: sentAt,
            status: 'sent',
            meta: {
              gmail: {
                messageId: message.id,
                threadId: message.threadId,
              },
            },
          });

        if (insertError) {
          console.error('Failed to insert message', insertError);
          errorsCount++;
          continue;
        }

        syncedCount++;

        // Update conversation metadata
        const { data: conversation } = await supabase
          .from('inbox_conversations')
          .select('last_message_at, unread_count, status')
          .eq('id', conversationId)
          .single();

        if (conversation) {
          const updateData: Record<string, unknown> = {
            last_message_preview: bodyText.slice(0, 120),
            updated_at: new Date().toISOString(),
          };

          const existingLastMessageAt = conversation.last_message_at
            ? new Date(conversation.last_message_at).getTime()
            : 0;
          const messageSentAt = new Date(sentAt).getTime();
          if (messageSentAt > existingLastMessageAt) {
            updateData.last_message_at = sentAt;
          }

          if (direction === 'inbound' && conversation.status === 'open') {
            updateData.unread_count = (conversation.unread_count || 0) + 1;
          }

          await supabase
            .from('inbox_conversations')
            .update(updateData)
            .eq('id', conversationId);
        }
      } catch (error) {
        console.error(`Error processing message ${messageId}:`, error);
        errorsCount++;
      }
    }

    return new Response(
      JSON.stringify({
        syncedCount,
        skippedCount,
        errorsCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('inbox-gmail-sync unexpected error', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});

type LinkState = "linked" | "unlinked" | "ambiguous";

async function attemptAutoLink(
  supabaseAdmin: any,
  conversationId: string,
  channel: "email" | "sms" | "whatsapp",
  primaryHandleRaw: string,
) {
  const { data: conv, error: convErr } = await supabaseAdmin
    .from("inbox_conversations")
    .select("id, person_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convErr) throw convErr;
  if (!conv) return;
  if (conv.person_id) return;

  const rawHandle = (primaryHandleRaw ?? "").trim();
  if (!rawHandle) {
    await updateLinkState(supabaseAdmin, conversationId, "unlinked", null, {});
    return;
  }

  const primaryHandle =
    channel === "email" ? rawHandle.toLowerCase() : rawHandle;
  if (!primaryHandle) {
    await updateLinkState(supabaseAdmin, conversationId, "unlinked", null, {});
    return;
  }

  const matchColumn = channel === "email" ? "email" : "phone";
  const matchTable = "customers";

  let query = supabaseAdmin.from(matchTable).select("id");
  if (channel === "email") {
    // Case-insensitive exact match on normalized email, no wildcards
    query = query.ilike(matchColumn, primaryHandle);
  } else {
    query = query.eq(matchColumn, primaryHandle);
  }

  const { data: matches, error: matchErr } = await query;

  if (matchErr) throw matchErr;

  const ids = (matches ?? []).map((m: any) => m.id);

  if (ids.length === 1) {
    await updateLinkState(supabaseAdmin, conversationId, "linked", ids[0], {});
    return;
  }

  if (ids.length > 1) {
    await updateLinkState(supabaseAdmin, conversationId, "ambiguous", null, {
      candidates: ids,
      matched_on: matchColumn,
    });
    return;
  }

  await updateLinkState(supabaseAdmin, conversationId, "unlinked", null, {});
}

async function updateLinkState(
  supabaseAdmin: any,
  conversationId: string,
  linkState: LinkState,
  personId: string | null,
  linkMeta: Record<string, unknown>,
) {
  const { error } = await supabaseAdmin
    .from("inbox_conversations")
    .update({
      person_id: personId,
      link_state: linkState,
      link_meta: linkMeta,
    })
    .eq("id", conversationId);

  if (error) throw error;
}
