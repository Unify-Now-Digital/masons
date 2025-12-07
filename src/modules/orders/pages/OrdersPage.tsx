import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Search, Plus, Filter, Calendar, MapPin, Clock, AlertTriangle, Settings } from 'lucide-react';
import { SortableOrdersTable } from "../components/SortableOrdersTable";
import { OrderDetailsSidebar } from "../components/OrderDetailsSidebar";

// Demo data - will be replaced with real Supabase queries
const orders = [
  {
    id: "ORD-001",
    customer: "John Smith",
    type: "Granite Headstone",
    stoneStatus: "Ordered",
    permitStatus: "approved",
    proofStatus: "In_Progress",
    dueDate: "2025-06-15",
    depositDate: "2025-05-20",
    secondPaymentDate: "2025-06-01",
    installationDate: "2025-06-12",
    value: "£2,500",
    location: "Oak Hill Cemetery",
    progress: 65,
    assignedTo: "Mike Johnson",
    priority: "high",
    sku: "GH-001-BLK",
    material: "Black Granite",
    color: "Jet Black",
    timelineWeeks: 18
  },
  {
    id: "ORD-002",
    customer: "Sarah Johnson",
    type: "Marble Memorial",
    stoneStatus: "In Stock",
    permitStatus: "approved",
    proofStatus: "Lettered",
    dueDate: "2025-06-10",
    depositDate: "2025-05-15",
    secondPaymentDate: "2025-05-30",
    installationDate: "2025-06-08",
    value: "£3,800",
    location: "Greenwood Memorial",
    progress: 95,
    assignedTo: "Sarah Davis",
    priority: "medium",
    sku: "MM-002-WHT",
    material: "Carrara Marble",
    color: "Pure White",
    timelineWeeks: 20
  },
  {
    id: "ORD-003",
    customer: "Mike Brown",
    type: "Bronze Plaque",
    stoneStatus: "NA",
    permitStatus: "form_sent",
    proofStatus: "Not_Received",
    dueDate: "2025-06-20",
    depositDate: "2025-05-25",
    secondPaymentDate: null,
    installationDate: null,
    value: "£1,200",
    location: "Sunset Cemetery",
    progress: 25,
    assignedTo: "Tom Wilson",
    priority: "low",
    sku: "BP-003-BRZ",
    material: "Cast Bronze",
    color: "Antique Bronze",
    timelineWeeks: 12
  }
];

export const OrdersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  const handleOrderUpdate = (orderId: string, updates: Partial<any>) => {
    console.log('Updating order:', orderId, updates);
    setSelectedOrder(updates);
  };

  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const filteredOrders = orders.filter(order => {
    const matchesTab = activeTab === "all" || 
                      (activeTab === "overdue" && getDaysUntilDue(order.dueDate) < 0) ||
                      (activeTab === "pending" && (order.permitStatus === "pending" || order.permitStatus === "form_sent" || order.proofStatus === "Not_Received")) ||
                      order.stoneStatus === activeTab || order.permitStatus === activeTab || order.proofStatus === activeTab;
    const matchesSearch = searchQuery === "" || 
                         order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.permitStatus === "pending" || o.permitStatus === "form_sent" || o.proofStatus === "Not_Received").length,
    overdue: orders.filter(o => getDaysUntilDue(o.dueDate) < 0).length,
    readyForInstall: orders.filter(o => o.stoneStatus === "In Stock" && o.permitStatus === "approved" && o.proofStatus === "Lettered").length
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Order Management</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track and manage all memorial orders
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setViewMode(viewMode === "table" ? "kanban" : "table")}>
            <Settings className="h-4 w-4 mr-2" />
            {viewMode === "table" ? "Kanban View" : "Table View"}
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-sm text-slate-600">Active Orders</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <p className="text-sm text-slate-600">Pending Approval</p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                <p className="text-sm text-slate-600">Overdue</p>
              </div>
              <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.readyForInstall}</div>
                <p className="text-sm text-slate-600">Ready for Install</p>
              </div>
              <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">All Orders</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Orders</CardTitle>
                <div className="flex gap-2 text-sm text-slate-600">
                  <span>Drag columns to reorder • Click headers to sort</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <SortableOrdersTable 
                orders={filteredOrders} 
                onViewOrder={(order) => setSelectedOrder(order)}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Details Sidebar */}
      <OrderDetailsSidebar 
        order={selectedOrder} 
        onClose={() => setSelectedOrder(null)}
        onOrderUpdate={handleOrderUpdate}
      />
    </div>
  );
};

export default OrdersPage;

