import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Search, FileCheck, FilePen, Send, UserCheck, CheckCircle2,
  Mail, MessageSquare, Bot,
} from 'lucide-react';
import type { PermitActivityLog, ActivityType } from '../types/permitAgent.types';
import { ACTIVITY_LABELS } from '../types/permitAgent.types';

interface ActivityTrackerProps {
  activities: PermitActivityLog[];
  className?: string;
}

const activityIcons: Record<ActivityType, React.ElementType> = {
  SEARCH_STARTED: Search,
  FORM_FOUND: FileCheck,
  PREFILLED: FilePen,
  SENT_TO_CLIENT: Send,
  CLIENT_RETURNED: UserCheck,
  SUBMITTED: Send,
  FOLLOW_UP_SENT: Mail,
  APPROVED: CheckCircle2,
  NOTE: MessageSquare,
};

const activityColors: Record<ActivityType, string> = {
  SEARCH_STARTED: 'text-yellow-600 bg-yellow-100',
  FORM_FOUND: 'text-blue-600 bg-blue-100',
  PREFILLED: 'text-indigo-600 bg-indigo-100',
  SENT_TO_CLIENT: 'text-purple-600 bg-purple-100',
  CLIENT_RETURNED: 'text-teal-600 bg-teal-100',
  SUBMITTED: 'text-orange-600 bg-orange-100',
  FOLLOW_UP_SENT: 'text-sky-600 bg-sky-100',
  APPROVED: 'text-green-600 bg-green-100',
  NOTE: 'text-slate-600 bg-slate-100',
};

function formatTimestamp(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ActivityTracker: React.FC<ActivityTrackerProps> = ({ activities, className }) => {
  if (activities.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-600" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-500 text-center py-6">
            No activity recorded yet. Start by searching for the permit form.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-600" />
          Activity Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" />

          <div className="space-y-4">
            {activities.map((activity, index) => {
              const Icon = activityIcons[activity.activity_type] || MessageSquare;
              const colorClass = activityColors[activity.activity_type] || 'text-slate-600 bg-slate-100';

              return (
                <div key={activity.id} className="relative flex gap-3 items-start">
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">
                        {ACTIVITY_LABELS[activity.activity_type]}
                      </span>
                      <span className="text-xs text-slate-400 flex-shrink-0">
                        {formatTimestamp(activity.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">{activity.description}</p>
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-1 text-xs text-slate-400">
                        {Object.entries(activity.metadata).map(([k, v]) => (
                          <span key={k} className="mr-3">
                            {k}: {String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
