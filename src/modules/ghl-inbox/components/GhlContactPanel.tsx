import React from 'react';
import type { GhlContactSummary } from '../api/ghlInbox.api';

type Props = {
  contact: GhlContactSummary | undefined;
  isLoading?: boolean;
  isError?: boolean;
  contactId: string | null;
};

function displayName(c: GhlContactSummary): string {
  if (c.name?.trim()) return c.name.trim();
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : 'Unknown contact';
}

export const GhlContactPanel: React.FC<Props> = ({
  contact,
  isLoading,
  isError,
  contactId,
}) => {
  if (!contactId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Contact details appear when a conversation is selected.
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading contact…</div>;
  }

  if (isError) {
    return (
      <div className="p-4 text-sm text-destructive">Could not load contact from GoHighLevel.</div>
    );
  }

  if (!contact) {
    return <div className="p-4 text-sm text-muted-foreground">No contact data.</div>;
  }

  return (
    <div className="p-4 space-y-3 text-sm">
      <h3 className="font-medium text-foreground">{displayName(contact)}</h3>
      <dl className="space-y-2">
        {contact.phone && (
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd>{contact.phone}</dd>
          </div>
        )}
        {contact.email && (
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="break-all">{contact.email}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">GHL contact ID</dt>
          <dd className="font-mono text-xs break-all">{contact.id}</dd>
        </div>
      </dl>
    </div>
  );
};
