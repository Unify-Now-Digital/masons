import React, { useState } from 'react';
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { 
  Bell, 
  BellOff, 
  Package, 
  MessageSquare, 
  AlertCircle, 
  Check,
  X,
  Clock
} from 'lucide-react';

// Demo notification data
const demoNotifications = [
  {
    id: 1,
    type: "order",
    title: "New order received",
    description: "John Smith placed order ORD-004 for Granite Headstone",
    timestamp: "5 minutes ago",
    isRead: false,
    orderId: "ORD-004"
  },
  {
    id: 2,
    type: "message",
    title: "New message from Sarah Johnson",
    description: "RE: Installation scheduling for Greenwood Memorial",
    timestamp: "1 hour ago",
    isRead: false
  },
  {
    id: 3,
    type: "reminder",
    title: "Order due soon",
    description: "ORD-002 is due in 3 days - verify installation readiness",
    timestamp: "2 hours ago",
    isRead: true
  },
  {
    id: 4,
    type: "system",
    title: "System update complete",
    description: "The latest updates have been applied successfully",
    timestamp: "1 day ago",
    isRead: true
  }
];

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "order": return <Package className="h-5 w-5 text-gardens-blu-dk" />;
    case "message": return <MessageSquare className="h-5 w-5 text-gardens-grn-dk" />;
    case "reminder": return <Clock className="h-5 w-5 text-gardens-amb-dk" />;
    case "system": return <AlertCircle className="h-5 w-5 text-gardens-tx" />;
    default: return <Bell className="h-5 w-5 text-gardens-tx" />;
  }
};

export const NotificationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState(demoNotifications);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !notification.isRead;
    return false;
  });

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const dismissNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-gardens-tx mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={markAllAsRead} className="w-full sm:w-auto">
            <Check className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="relative">
            All
            {notifications.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {notifications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread" className="relative">
            Unread
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4 mt-4">
          {filteredNotifications.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-gardens-txs">
                <BellOff className="h-12 w-12 mx-auto mb-4" />
                <p className="text-lg font-medium">No notifications</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            </Card>
          ) : (
            filteredNotifications.map((notification) => (
              <Card 
                key={notification.id}
                className={`transition-all hover:shadow-md ${
                  !notification.isRead ? "border-gardens-blu-lt bg-gardens-blu-lt/50" : ""
                }`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-full ${
                      !notification.isRead ? "bg-gardens-blu-lt" : "bg-gardens-page"
                    }`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{notification.title}</h4>
                        {!notification.isRead && (
                          <Badge variant="default" className="text-xs">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gardens-tx mt-1">
                        {notification.description}
                      </p>
                      <p className="text-xs text-gardens-txs mt-2">
                        {notification.timestamp}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.isRead && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => dismissNotification(notification.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationsPage;

