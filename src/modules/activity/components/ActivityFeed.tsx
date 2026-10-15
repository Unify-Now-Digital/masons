import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/shared/lib/utils';
import { useActivityFeed } from '../hooks/useActivityFeed';
import {
  FEED_FILTERS,
  eventHref,
  filterFeed,
  groupFeed,
  londonTime,
  type FeedEvent,
  type FeedFilter,
} from '../feed';

export function ActivityFeedView({
  events,
  readIds,
  filter,
  onFilter,
  now = new Date(),
  onOpen,
  onResolve,
  onMarkAll,
  unavailable = false,
}: {
  events: FeedEvent[];
  readIds: ReadonlySet<string>;
  filter: FeedFilter;
  onFilter: (filter: FeedFilter) => void;
  now?: Date;
  onOpen?: (event: FeedEvent) => void;
  onResolve?: (event: FeedEvent) => void;
  onMarkAll?: () => void;
  unavailable?: boolean;
}) {
  const shown = filterFeed(events, filter);
  const groups = groupFeed(shown, now);
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="activity-feed">
      <div className="flex items-center gap-2 px-3 pt-2">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-2">
          {FEED_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilter(item.id)}
              className={cn(
                'h-8 shrink-0 rounded-full px-2.5 text-[12px] font-semibold',
                filter === item.id ? 'bg-gardens-acc text-white' : 'bg-gardens-page text-gardens-txs',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        {onMarkAll && (
          <button type="button" onClick={onMarkAll} className="mb-2 shrink-0 text-[12px] font-semibold text-gardens-acc-dk">
            Mark all read
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {unavailable && <p className="px-4 py-6 text-[13px] text-gardens-txs">Activity isn’t connected yet.</p>}
        {!unavailable && groups.length === 0 && <p className="px-4 py-6 text-[13px] text-gardens-txm">Nothing here yet.</p>}
        {groups.map((group) => (
          <section key={group.label}>
            <h3 className="m-0 px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-gardens-txs">{group.label}</h3>
            <ul className="m-0 list-none p-0">
              {group.events.map((event) => (
                <FeedRow
                  key={event.id}
                  event={event}
                  unread={!readIds.has(event.id)}
                  onOpen={onOpen}
                  onResolve={onResolve}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function FeedRow({
  event,
  unread,
  onOpen,
  onResolve,
}: {
  event: FeedEvent;
  unread: boolean;
  onOpen?: (event: FeedEvent) => void;
  onResolve?: (event: FeedEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const children = event.payload?.children ?? [];
  return (
    <li className="border-b border-gardens-bdr/70">
      <button
        type="button"
        onClick={() => {
          if (children.length) setOpen((value) => !value);
          onOpen?.(event);
        }}
        className="flex min-h-11 w-full items-center gap-2 px-4 text-left"
      >
        <span className={cn('h-2 w-2 shrink-0 rounded-full', unread ? 'bg-gardens-acc' : 'bg-transparent')} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-gardens-tx">{event.title}</span>
          {event.body && <span className="block truncate text-[12px] text-gardens-txs">{event.body}</span>}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-gardens-txm">{londonTime(event.created_at)}</span>
      </button>
      {open && children.length > 0 && (
        <ul className="m-0 list-none space-y-1 px-8 pb-2">
          {children.map((child, index) => (
            <li key={`${child.job_code ?? child.title ?? 'row'}-${index}`} className="text-[12px] text-gardens-txs">
              {child.job_code ?? child.title ?? 'Update'}
              {child.from || child.to ? ` · ${child.from ?? '—'} → ${child.to ?? '—'}` : ''}
              {child.detail ? ` · ${child.detail}` : ''}
            </li>
          ))}
        </ul>
      )}
      {event.priority === 'action' && !event.resolved_at && onResolve && (
        <div className="px-8 pb-2">
          <button type="button" className="text-[12px] font-semibold text-gardens-acc-dk" onClick={() => onResolve(event)}>
            Resolve
          </button>
        </div>
      )}
    </li>
  );
}

export function ActivityFeed({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const feed = useActivityFeed();
  return (
    <ActivityFeedView
      events={feed.events}
      readIds={feed.readIds}
      filter={feed.filter}
      onFilter={feed.setFilter}
      unavailable={feed.unavailable}
      onMarkAll={feed.markAllRead}
      onOpen={(event) => {
        feed.markRead(event.id);
        const href = eventHref(event);
        if (href) {
          onNavigate?.();
          navigate(href);
        }
      }}
      onResolve={(event) => feed.resolve(event.id)}
    />
  );
}
