import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface InboxAvatarPillProps {
  /** Two-letter initials (e.g. "RC", "?") */
  initials: string;
  /** Optional status dot on avatar: urgent (red), unlinked (violet). Omit for target style (dot goes after name). */
  statusDot?: 'urgent' | 'unlinked' | null;
  className?: string;
}

/** Avatar/initial pill for conversation list rows. Dark green, white initials, compact rounded. */
export const InboxAvatarPill: React.FC<InboxAvatarPillProps> = ({
  initials,
  statusDot = null,
  className,
}) => {
  const dotClass =
    statusDot === 'urgent'
      ? 'bg-gardens-red'
      : statusDot === 'unlinked'
        ? 'bg-gardens-blu'
        : '';

  return (
    <div
      className={cn(
        'relative h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-[13px] font-semibold',
        'bg-gardens-grn-dk text-white',
        className
      )}
    >
      {initials}
      {dotClass && (
        <span
          className={cn(
            'absolute top-0 right-0 h-2 w-2 rounded-full border-2 border-white',
            dotClass
          )}
          style={{ transform: 'translate(25%, -25%)' }}
          aria-hidden
        />
      )}
    </div>
  );
};
