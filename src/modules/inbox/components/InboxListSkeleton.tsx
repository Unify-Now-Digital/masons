import React from 'react';

/** Placeholder rows while a list query is in flight. Replaces "Loading…" / "Ranking…" copy. */
export const InboxListSkeleton: React.FC<{ rows?: number; label?: string }> = ({ rows = 6, label = 'Loading' }) => (
  <div className="flex flex-col gap-2 px-3 py-3" role="status" aria-live="polite" aria-busy="true" aria-label={label}>
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="h-14 animate-pulse rounded-lg bg-gardens-page" />
    ))}
  </div>
);
