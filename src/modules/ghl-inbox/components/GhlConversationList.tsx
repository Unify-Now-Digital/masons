import React, { useMemo } from 'react';
import { cn } from '@/shared/lib/utils';
import type { GhlConversationSummary } from '../api/ghlInbox.api';

type Props = {
  conversations: GhlConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
};

function formatPreview(body: string | null): string {
  if (!body?.trim()) return 'No preview';
  const t = body.trim();
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const GhlConversationList: React.FC<Props> = ({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}) => {
  const sorted = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        const ta = a.lastMessageDate ? new Date(a.lastMessageDate).getTime() : 0;
        const tb = b.lastMessageDate ? new Date(b.lastMessageDate).getTime() : 0;
        return tb - ta;
      }),
    [conversations],
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Loading conversations…
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        No conversations yet.
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto divide-y divide-border">
      {sorted.map((c) => {
        const unread = (c.unreadCount ?? 0) > 0;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                'w-full text-left px-3 py-3 hover:bg-muted/60 transition-colors',
                selectedId === c.id && 'bg-muted',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground font-mono truncate">
                  {c.contactId ? `Contact ${c.contactId.slice(0, 8)}…` : 'Conversation'}
                </span>
                {unread && (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    {c.unreadCount}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm line-clamp-2">{formatPreview(c.lastMessageBody)}</p>
              {c.lastMessageDate && (
                <p className="mt-1 text-xs text-muted-foreground">{formatWhen(c.lastMessageDate)}</p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
};
