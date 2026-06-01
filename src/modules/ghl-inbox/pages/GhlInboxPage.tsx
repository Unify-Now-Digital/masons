import React, { useMemo, useState } from 'react';
import { useOrganization } from '@/shared/context/OrganizationContext';
import { GhlConnectionAdminStrip } from '../components/GhlConnectionAdminStrip';
import { GhlContactPanel } from '../components/GhlContactPanel';
import { GhlConversationList } from '../components/GhlConversationList';
import { GhlMessageThread } from '../components/GhlMessageThread';
import { useGhlConnection } from '../hooks/useGhlConnection';
import { useGhlContact } from '../hooks/useGhlContact';
import { useGhlConversations } from '../hooks/useGhlConversations';
import { useGhlInboxRealtime } from '../hooks/useGhlInboxRealtime';
import { useGhlMessages } from '../hooks/useGhlMessages';

export const GhlInboxPage: React.FC = () => {
  const { isOrgAdmin } = useOrganization();
  const connectionQuery = useGhlConnection();
  const connection = connectionQuery.data;
  const isActive = connection?.status === 'active';

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const conversationsQuery = useGhlConversations(isActive);
  const messagesQuery = useGhlMessages(selectedId);

  useGhlInboxRealtime(selectedId);

  const selectedConversation = useMemo(
    () => conversationsQuery.data?.find((c) => c.id === selectedId) ?? null,
    [conversationsQuery.data, selectedId],
  );

  const contactId = selectedConversation?.contactId ?? null;
  const contactQuery = useGhlContact(contactId);

  if (connectionQuery.isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-sm text-muted-foreground">
        Checking GoHighLevel connection…
      </div>
    );
  }

  if (!connection || connection.status !== 'active') {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-base font-medium">GoHighLevel inbox unavailable</p>
        <p className="max-w-md text-sm text-muted-foreground">
          {connection?.status === 'disconnected'
            ? 'This organisation’s GHL connection has been disconnected. Ask an administrator to restore access.'
            : 'No active GoHighLevel connection is configured for this organisation.'}
        </p>
        {isOrgAdmin && connection && connection.status !== 'active' && (
          <p className="text-xs text-muted-foreground font-mono">
            Status: {connection.status} · Location: {connection.ghl_location_id.slice(0, 8)}…
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col min-h-0 border border-border rounded-lg overflow-hidden bg-background">
      {isOrgAdmin && <GhlConnectionAdminStrip connection={connection} />}

      {conversationsQuery.isError && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10">
          {conversationsQuery.error instanceof Error
            ? conversationsQuery.error.message
            : 'Could not load conversations.'}
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <aside className="w-full max-w-xs shrink-0 border-r border-border flex flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">
            {connection.outbound_enabled
              ? 'Live from GoHighLevel'
              : 'Live from GoHighLevel (read-only)'}
          </div>
          <GhlConversationList
            conversations={conversationsQuery.data ?? []}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isLoading={conversationsQuery.isLoading}
          />
        </aside>

        <main className="flex flex-1 flex-col min-h-0 min-w-0">
          <GhlMessageThread
            conversationId={selectedId}
            contactId={contactId}
            unreadCount={selectedConversation?.unreadCount ?? 0}
            outboundEnabled={connection.outbound_enabled ?? false}
            messages={messagesQuery.data ?? []}
            isLoading={messagesQuery.isLoading}
            isError={messagesQuery.isError}
            errorMessage={
              messagesQuery.error instanceof Error ? messagesQuery.error.message : undefined
            }
          />
        </main>

        <aside className="hidden lg:flex w-64 shrink-0 border-l border-border flex-col min-h-0">
          <div className="px-3 py-2 border-b border-border text-xs font-medium">Contact</div>
          <GhlContactPanel
            contactId={contactId}
            contact={contactQuery.data}
            isLoading={contactQuery.isLoading}
            isError={contactQuery.isError}
          />
        </aside>
      </div>
    </div>
  );
};
