import React from 'react';
import { ActivityFeed } from '@/modules/activity/components/ActivityFeed';

export const NotificationsPage: React.FC = () => {
  return (
    <div className="mx-auto flex h-full min-h-0 max-w-2xl flex-col p-4">
      <h1 className="mb-3 font-head text-[22px] font-semibold text-gardens-tx">Activity</h1>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-gardens-bdr bg-gardens-surf">
        <ActivityFeed />
      </div>
    </div>
  );
};
