import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Mail, Phone, Calendar, MapPin, DollarSign, AlertTriangle, Send } from 'lucide-react';
import { Textarea } from "@/shared/components/ui/textarea";
import { CommunicationIntegrations } from "./CommunicationIntegrations";

export interface InboxCommunication {
  id: string | number;
  type?: string | null;
  from: string;
  subject: string | null;
  content: string;
  timestamp: string;
  orderId: string | null;
  priority?: string | null;
  depositDate?: string;
  productOrdered?: string;
  orderValue?: string;
  customerEmail?: string;
  customerPhone?: string;
}

interface ConversationViewProps {
  communication: InboxCommunication | null;
}

export const ConversationView: React.FC<ConversationViewProps> = ({ communication }) => {
  if (!communication) {
    return (
      <Card className="h-full">
        <CardContent className="h-full flex items-center justify-center">
          <div className="text-center text-slate-400">
            <Mail className="h-12 w-12 mx-auto mb-4" />
            <p>Select a message to view conversation</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "email": return <Mail className="h-4 w-4" />;
      case "phone": return <Phone className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const mockConversation = [
    {
      id: 1,
      sender: communication.from,
      content: communication.content,
      timestamp: communication.timestamp,
      isCustomer: true
    },
    {
      id: 2,
      sender: "You",
      content: "Thank you for reaching out. I'll review your requirements and get back to you with options and pricing by tomorrow.",
      timestamp: "1 hour ago",
      isCustomer: false
    }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Communication Integrations */}
      <CommunicationIntegrations 
        customerEmail={communication.customerEmail || `${communication.from.toLowerCase().replace(' ', '.')}@email.com`}
        customerPhone={communication.customerPhone || "+1 (555) 123-4567"}
      />

      {/* Contact Details Header */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarFallback>{communication.from.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">{communication.from}</CardTitle>
                <p className="text-sm text-slate-600">{communication.subject}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {communication.priority === "high" && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  High Priority
                </Badge>
              )}
              <Badge variant="outline">{communication.orderId}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span className="font-medium">Product:</span>
                <span>{communication.productOrdered || "Granite Headstone"}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-slate-400" />
                <span className="font-medium">Value:</span>
                <span>{communication.orderValue || "$2,500"}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span className="font-medium">Deposit Date:</span>
                <span>{communication.depositDate || "2025-05-20"}</span>
              </div>
              <div className="flex items-center gap-2">
                {getIcon(communication.type)}
                <span className="font-medium">Type:</span>
                <span className="capitalize">{communication.type}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversation Thread */}
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto max-h-96 mb-4">
            {mockConversation.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isCustomer ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.isCustomer
                      ? 'bg-slate-100 text-slate-900'
                      : 'bg-blue-500 text-white'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.isCustomer ? 'text-slate-500' : 'text-blue-100'
                  }`}>
                    {message.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply Box */}
          <div className="border-t pt-4">
            <Textarea 
              placeholder="Type your reply..."
              className="mb-3"
              rows={3}
            />
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button variant="outline" size="sm">Template</Button>
                <Button variant="outline" size="sm">Attach</Button>
              </div>
              <Button size="sm">
                <Send className="h-4 w-4 mr-2" />
                Send Reply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConversationView;

