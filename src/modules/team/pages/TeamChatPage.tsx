import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Hash, Send, Circle, Users, MessageSquare } from 'lucide-react';

// Demo data
const demoChannels = [
  { id: "general", name: "General", unread: 2 },
  { id: "orders", name: "Orders", unread: 0 },
  { id: "installations", name: "Installations", unread: 5 },
];

const demoMembers = [
  { id: 1, name: "Mike Johnson", status: "online", initials: "MJ" },
  { id: 2, name: "Sarah Davis", status: "online", initials: "SD" },
  { id: 3, name: "Tom Wilson", status: "away", initials: "TW" },
];

const demoMessages = [
  {
    id: 1,
    sender: "Mike Johnson",
    initials: "MJ",
    content: "Just finished the installation at Oak Hill Cemetery",
    timestamp: "10:30 AM",
    isOwn: false
  },
  {
    id: 2,
    sender: "You",
    initials: "ME",
    content: "Great work! How did the client react?",
    timestamp: "10:32 AM",
    isOwn: true
  },
  {
    id: 3,
    sender: "Mike Johnson",
    initials: "MJ",
    content: "They were very happy with the final result. The family was emotional but thankful.",
    timestamp: "10:35 AM",
    isOwn: false
  },
  {
    id: 4,
    sender: "Sarah Davis",
    initials: "SD",
    content: "That's wonderful to hear! Great job Mike 👏",
    timestamp: "10:40 AM",
    isOwn: false
  },
  {
    id: 5,
    sender: "You",
    initials: "ME",
    content: "Agreed! Let's make sure the photos are added to the portfolio.",
    timestamp: "10:42 AM",
    isOwn: true
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "online": return "bg-gardens-grn";
    case "away": return "bg-gardens-amb";
    default: return "bg-gardens-bdr2";
  }
};

export const TeamChatPage: React.FC = () => {
  const [selectedChannel, setSelectedChannel] = useState("general");
  const [messageInput, setMessageInput] = useState("");

  const selectedChannelData = demoChannels.find(c => c.id === selectedChannel);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Chat</h1>
        <p className="text-sm text-gardens-tx mt-1">
          Communicate with your team in real-time
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 h-auto md:h-[calc(100vh-220px)]">
        {/* Sidebar - Channels & Members */}
        <Card className="md:col-span-1 flex flex-col max-h-[300px] md:max-h-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Hash className="h-4 w-4" />
              Channels
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-1">
                {demoChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => setSelectedChannel(channel.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors ${
                      selectedChannel === channel.id 
                        ? "bg-gardens-blu-lt text-gardens-blu-dk" 
                        : "hover:bg-gardens-page"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      <span className="text-sm font-medium">{channel.name}</span>
                    </div>
                    {channel.unread > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {channel.unread}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-6 pb-4">
                <div className="flex items-center gap-2 px-3 mb-3">
                  <Users className="h-4 w-4 text-gardens-txs" />
                  <span className="text-sm font-medium text-gardens-tx">Team Members</span>
                </div>
                <div className="space-y-2">
                  {demoMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="relative">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{member.initials}</AvatarFallback>
                        </Avatar>
                        <Circle 
                          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 ${getStatusColor(member.status)} rounded-full border-2 border-white`}
                          fill="currentColor"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-gardens-txs capitalize">{member.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="md:col-span-2 lg:col-span-3 flex flex-col min-h-[400px]">
          {/* Channel Header */}
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-gardens-txs" />
                <CardTitle className="text-lg">{selectedChannelData?.name}</CardTitle>
              </div>
              <div className="flex items-center gap-2 text-sm text-gardens-txs">
                <Users className="h-4 w-4" />
                <span>{demoMembers.length} members</span>
              </div>
            </div>
          </CardHeader>

          {/* Messages */}
          <CardContent className="flex-1 p-0 flex flex-col">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {demoMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.isOwn ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">{message.initials}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[70%] flex flex-col ${message.isOwn ? "items-end" : "items-start"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${message.isOwn ? "text-gardens-blu-dk" : ""}`}>
                          {message.sender}
                        </span>
                        <span className="text-xs text-gardens-txs">{message.timestamp}</span>
                      </div>
                      <div
                        className={`px-4 py-2 rounded-lg ${
                          message.isOwn
                            ? "bg-gardens-blu text-white"
                            : "bg-gardens-page text-gardens-tx"
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder={`Message #${selectedChannelData?.name}...`}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  className="flex-1"
                />
                <Button>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-gardens-txs mt-2">
                Press Enter to send (coming in Phase 2)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamChatPage;
