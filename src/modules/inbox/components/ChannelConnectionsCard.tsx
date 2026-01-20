import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Mail, Phone, MessageSquare } from 'lucide-react';
import { useChannelAccounts } from '../hooks/useInboxChannels';

export const ChannelConnectionsCard: React.FC = () => {
  const { data: accounts = [], isLoading } = useChannelAccounts();

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <Phone className="h-4 w-4" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4" />;
      default: return null;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'email': return 'Email';
      case 'sms': return 'SMS';
      case 'whatsapp': return 'WhatsApp';
      default: return channel;
    }
  };

  const isChannelConnected = (channel: string) => {
    const account = accounts.find(a => a.channel === channel);
    return account?.is_connected ?? false;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Communication Channels</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const channels = ['email', 'sms', 'whatsapp'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Communication Channels</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 flex-wrap">
          {channels.map(channel => {
            const connected = isChannelConnected(channel);
            return (
              <Badge
                key={channel}
                variant={connected ? "default" : "outline"}
                className="flex items-center gap-1"
              >
                {getChannelIcon(channel)}
                {getChannelLabel(channel)}
                {connected ? ' ✓' : ''}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
