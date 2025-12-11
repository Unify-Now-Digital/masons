import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get user's Gmail accounts
    const { data: accounts, error: accountsError } = await supabaseClient
      .from("gmail_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (accountsError) throw accountsError;

    for (const account of accounts || []) {
      await syncGmailAccount(supabaseClient, account);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Gmail sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

type GmailAccount = {
  id: string;
  user_id: string;
  email: string;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  is_active: boolean;
};

type GmailMessageListResponse = {
  messages?: { id: string; threadId?: string }[];
  nextPageToken?: string;
};

type GmailHeader = { name: string; value: string };

async function syncGmailAccount(supabaseClient: SupabaseClient, account: GmailAccount) {
  try {
    // Refresh token if needed
    let accessToken = account.access_token;
    if (new Date(account.token_expires_at) <= new Date()) {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
          client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
          refresh_token: account.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        expires_in: number;
      };
      accessToken = tokens.access_token;

      // Update stored tokens
      await supabaseClient
        .from("gmail_accounts")
        .update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        })
        .eq("id", account.id);
    }

    // Get recent emails
    const messagesResponse = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=is:unread OR newer_than:7d",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const messagesData = (await messagesResponse.json()) as GmailMessageListResponse;

    if (messagesData.messages) {
      for (const message of messagesData.messages) {
        await syncMessage(supabaseClient, account.id, message.id, accessToken);
      }
    }
  } catch (error: unknown) {
    console.error(`Error syncing account ${account.email}:`, error);
  }
}

async function syncMessage(
  supabaseClient: SupabaseClient,
  accountId: string,
  messageId: string,
  accessToken: string
) {
  try {
    // Check if message already exists
    const { data: existing } = await supabaseClient
      .from("gmail_emails")
      .select("id")
      .eq("message_id", messageId)
      .eq("gmail_account_id", accountId)
      .single();

    if (existing) return; // Already synced

    // Get message details
    const messageResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const messageData = (await messageResponse.json()) as {
      threadId: string;
      labelIds: string[];
      payload: {
        headers: GmailHeader[];
        body?: { data?: string };
        parts?: Array<{
          mimeType?: string;
          body?: { data?: string };
        }>;
      };
    };
    
    const headers = messageData.payload.headers;
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    const to = headers.find((h) => h.name === "To")?.value || "";
    const date = headers.find((h) => h.name === "Date")?.value || "";

    // Parse from field
    const fromMatch = from.match(/^(.*?)\s*<(.+)>$/) || [null, from, from];
    const fromName = fromMatch[1]?.trim() || "";
    const fromEmail = fromMatch[2]?.trim() || from;

    // Get email content
    let contentText = "";
    let contentHtml = "";
    
    if (messageData.payload.body?.data) {
      contentText = atob(messageData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } else if (messageData.payload.parts) {
      for (const part of messageData.payload.parts) {
        if (part.mimeType === "text/plain" && part.body?.data) {
          contentText = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (part.mimeType === "text/html" && part.body?.data) {
          contentHtml = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
      }
    }

    // Store email
    await supabaseClient
      .from("gmail_emails")
      .insert({
        gmail_account_id: accountId,
        message_id: messageId,
        thread_id: messageData.threadId,
        subject,
        from_name: fromName,
        from_email: fromEmail,
        to_email: to,
        content_text: contentText,
        content_html: contentHtml,
        labels: messageData.labelIds,
        is_read: !messageData.labelIds.includes("UNREAD"),
        received_at: new Date(date).toISOString(),
      });
  } catch (error: unknown) {
    console.error(`Error syncing message ${messageId}:`, error);
  }
}

serve(handler);