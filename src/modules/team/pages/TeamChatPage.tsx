import React from 'react';
import { Card, CardContent } from "@/shared/components/ui/card";
import { MessageSquare } from 'lucide-react';

export const TeamChatPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Chat</h1>
        <p className="text-sm text-slate-600 mt-1">
          Coming in Phase 2
        </p>
      </div>
      
      <Card className="h-96 flex items-center justify-center">
        <CardContent className="text-center text-slate-400">
          <MessageSquare className="h-12 w-12 mx-auto mb-4" />
          <p>Team chat functionality will be available in Phase 2</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamChatPage;

