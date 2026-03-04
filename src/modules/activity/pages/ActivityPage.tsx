import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabase";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";

interface ActivityLogItem {
  id: string;
  created_at: string;
  entity_type: string;
  entity_id: string;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }>;
}

async function fetchMyActivity(): Promise<ActivityLogItem[]> {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, created_at, entity_type, entity_id, action, changes")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (data || []) as ActivityLogItem[];
}

export const ActivityPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["activity_logs", "me"],
    queryFn: fetchMyActivity,
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">My Activity</h1>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-red-600">
          {(error as Error).message || "Failed to load activity"}
        </p>
      )}
      {!isLoading && !error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent actions</CardTitle>
          </CardHeader>
          <CardContent>
            {data && data.length > 0 ? (
              <ul className="space-y-3">
                {data.map((log) => (
                  <li key={log.id} className="border-b pb-2 last:border-b-0">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                      <span>
                        {log.entity_type} · {log.action}
                      </span>
                    </div>
                    <div className="mt-1 text-xs break-words">
                      <span className="font-mono text-[11px]">
                        {log.entity_type}({log.entity_id})
                      </span>
                    </div>
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <pre className="mt-1 text-[11px] whitespace-pre-wrap bg-slate-50 rounded p-1 border border-slate-100">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

