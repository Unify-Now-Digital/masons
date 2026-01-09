import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { MapPin, Calendar, Clock, Navigation, Filter, Route, Search, RefreshCw } from 'lucide-react';
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { GoogleMap } from "../components/GoogleMap";
import { OrderInfoPanel } from "../components/OrderInfoPanel";
import { StatusFilterControl } from "../components/StatusFilterControl";
import { CreateJobDrawer } from '@/modules/jobs/components/CreateJobDrawer';
import { useOrdersForMap } from '../hooks/useOrders';
import { transformOrdersToMarkers, type OrderMapMarker } from '../utils/orderMapTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { format } from 'date-fns';
import type { Order } from '@/modules/orders/types/orders.types';
import { getOrderTotal } from '@/modules/orders/utils/orderCalculations';
import { OPERATIONAL_STATUSES, type OperationalStatus } from '../utils/orderStatusMap';

export const JobsMapPage: React.FC = () => {
  const { data: ordersData, isLoading, error, refetch } = useOrdersForMap();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedOrderForInfo, setSelectedOrderForInfo] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isCreateJobDrawerOpen, setIsCreateJobDrawerOpen] = useState(false);
  const [enabledStatuses, setEnabledStatuses] = useState<Set<OperationalStatus>>(
    new Set(OPERATIONAL_STATUSES) // Default: all enabled
  );

  // Toggle selection function
  const toggleOrderSelection = (orderId: string, isAssigned: boolean) => {
    if (isAssigned) return; // Cannot select assigned Orders
    
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  // Clear selection function
  const clearSelection = () => {
    setSelectedOrderIds(new Set());
  };

  // Transform orders to markers
  const markers = useMemo(() => {
    if (!ordersData) return [];
    return transformOrdersToMarkers(ordersData);
  }, [ordersData]);

  // Filter markers based on search and status
  const filteredMarkers = useMemo(() => {
    let filtered = markers;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(marker =>
        marker.customer.toLowerCase().includes(query) ||
        marker.location.toLowerCase().includes(query) ||
        (marker.sku && marker.sku.toLowerCase().includes(query))
      );
    }
    
    // Status filter
    if (enabledStatuses.size > 0 && enabledStatuses.size < OPERATIONAL_STATUSES.length) {
      filtered = filtered.filter(marker => 
        enabledStatuses.has(marker.operationalStatus)
      );
    }
    
    return filtered;
  }, [markers, searchQuery, enabledStatuses]);

  const getAssignmentBadge = (isAssigned: boolean) => {
    if (isAssigned) {
      return "bg-gray-100 text-gray-700";
    }
    return "bg-blue-100 text-blue-700";
  };

  // Calculate total price of selected Orders (includes base value + permit cost + additional options)
  const selectedOrdersTotal = useMemo(() => {
    if (!ordersData || selectedOrderIds.size === 0) return 0;
    
    return Array.from(selectedOrderIds)
      .reduce((sum, orderId) => {
        const order = ordersData.find(o => o.id === orderId);
        if (!order) return sum;
        // Use shared calculation utility to include all costs (handles Renovation orders correctly)
        return sum + getOrderTotal(order);
      }, 0);
  }, [ordersData, selectedOrderIds]);

  // Handle marker click to show info panel
  const handleMarkerClick = (orderId: string) => {
    const order = ordersData?.find(o => o.id === orderId);
    if (order) {
      setSelectedOrderForInfo(order);
    }
  };

  // Handle toggle selection from info panel
  const handleToggleSelectionFromPanel = (orderId: string) => {
    const order = ordersData?.find(o => o.id === orderId);
    if (order && !order.job_id) {
      toggleOrderSelection(orderId, false);
    }
  };

  // Handle view order navigation
  const handleViewOrder = (orderId: string) => {
    // Navigate to Orders module (or open Order detail drawer)
    window.location.href = `/dashboard/orders?order=${orderId}`;
  };

  // Get first selected Order for auto-filling location
  const firstSelectedOrder = useMemo(() => {
    if (!ordersData || selectedOrderIds.size === 0) return null;
    const firstId = Array.from(selectedOrderIds)[0];
    return ordersData.find(o => o.id === firstId) || null;
  }, [ordersData, selectedOrderIds]);

  // Handle Create Job button click
  const handleCreateJob = () => {
    if (selectedOrderIds.size === 0) return;
    
    // Filter to only visible and unassigned Orders
    const visibleOrderIds = new Set(filteredMarkers.map(m => m.id));
    const validSelectedIds = Array.from(selectedOrderIds).filter(id => {
      const marker = filteredMarkers.find(m => m.id === id);
      return marker && !marker.isAssigned && visibleOrderIds.has(id);
    });
    
    if (validSelectedIds.length === 0) {
      toast({
        title: 'No valid orders selected',
        description: 'Selected orders must be visible and unassigned.',
        variant: 'destructive',
      });
      return;
    }
    
    // Update selectedOrderIds to only valid ones
    setSelectedOrderIds(new Set(validSelectedIds));
    setIsCreateJobDrawerOpen(true);
  };

  // Handle drawer close
  const handleDrawerClose = (open: boolean) => {
    setIsCreateJobDrawerOpen(open);
  };

  // Handle Job creation success
  const handleJobCreated = () => {
    // Refresh Orders data
    refetch();
    
    // Clear selection
    clearSelection();
    
    // Close drawer
    setIsCreateJobDrawerOpen(false);
    
    // Close info panel if open
    setSelectedOrderForInfo(null);
    
    // Show success message
    toast({
      title: 'Job created',
      description: `Job created with ${selectedOrderIds.size} order(s).`,
    });
  };

  // Handle Job creation error
  const handleJobCreationError = (error: Error) => {
    toast({
      title: 'Failed to create job',
      description: error.message || 'An error occurred while creating the job.',
      variant: 'destructive',
    });
    // Selection state is maintained (not cleared) to allow retry
  };

  // Auto-deselect hidden Orders when filters change
  useEffect(() => {
    const visibleOrderIds = new Set(filteredMarkers.map(m => m.id));
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      let changed = false;
      // Remove any selected IDs that are not visible
      prev.forEach(id => {
        if (!visibleOrderIds.has(id)) {
          next.delete(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [filteredMarkers]);

  // Error handling
  useEffect(() => {
    if (error) {
      toast({
        title: 'Error loading orders',
        description: error.message || 'Failed to load order locations',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Map of Orders</h1>
          <p className="text-sm text-slate-600 mt-1">
            View order locations and create jobs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Route className="h-4 w-4 mr-2" />
            Optimize Route
          </Button>
          <Button variant="outline">
            <Navigation className="h-4 w-4 mr-2" />
            Get Directions
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className="h-[600px]">
            <CardHeader>
              <div className="flex justify-between items-center mb-4">
                <CardTitle>Interactive Map</CardTitle>
              </div>
              <StatusFilterControl
                enabledStatuses={enabledStatuses}
                onStatusToggle={(status) => {
                  setEnabledStatuses(prev => {
                    const next = new Set(prev);
                    if (next.has(status)) {
                      next.delete(status);
                    } else {
                      next.add(status);
                    }
                    return next;
                  });
                }}
                onSelectAll={() => setEnabledStatuses(new Set(OPERATIONAL_STATUSES))}
                onClearAll={() => setEnabledStatuses(new Set())}
              />
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search locations, customers, or addresses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="h-full">
              <GoogleMap 
                markers={filteredMarkers}
                selectedMarker={selectedOrder}
                selectedMarkerIds={selectedOrderIds}
                onMarkerSelect={(id) => {
                  setSelectedOrder(id);
                  if (id) handleMarkerClick(id);
                }}
                onMarkerToggle={toggleOrderSelection}
                isLoading={isLoading}
                error={error}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Tabs value={activeFilter} onValueChange={setActiveFilter}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">All Orders</TabsTrigger>
              <TabsTrigger value="unassigned">Unassigned</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeFilter} className="space-y-4">
              <h3 className="text-lg font-semibold">
                {activeFilter === "unassigned" ? "Unassigned Orders" : "All Orders"}
              </h3>
              
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : filteredMarkers.length === 0 ? (
                <div className="text-center py-8 text-slate-600">
                  {searchQuery
                    ? 'No orders match your search'
                    : enabledStatuses.size === 0
                    ? 'No status filters selected. Enable at least one status to view orders.'
                    : 'No orders match the selected status filters'}
                </div>
              ) : (
                filteredMarkers
                  .filter(marker => activeFilter === 'unassigned' ? !marker.isAssigned : true)
                  .map((marker) => (
                  <Card 
                    key={marker.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedOrder === marker.id ? "ring-2 ring-blue-500" : ""
                    }`}
                    onClick={() => {
                      const newSelected = selectedOrder === marker.id ? null : marker.id;
                      setSelectedOrder(newSelected);
                      if (newSelected) handleMarkerClick(newSelected);
                    }}
                  >
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{marker.customer}</h4>
                          <p className="text-sm text-slate-600">{marker.location}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={getAssignmentBadge(marker.isAssigned)}>
                            {marker.isAssigned ? 'Assigned' : 'Available'}
                          </Badge>
                          {marker.priority === "high" && (
                            <Badge variant="destructive">Urgent</Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm text-slate-600">
                        <div className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          <span>{marker.location}</span>
                        </div>
                        {marker.sku && (
                          <div className="flex items-center">
                            <span>Grave Number: {marker.sku}</span>
                          </div>
                        )}
                        {marker.value && (
                          <div className="flex items-center">
                            <span>Price: £{marker.value.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      {selectedOrder === marker.id && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                          <p className="text-sm text-slate-600">{marker.address}</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <a href={`/dashboard/orders?order=${marker.id}`}>
                                View Order
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>

        </div>
      </div>

      {/* Selection Action Bar */}
      {selectedOrderIds.size > 0 && (
        <Card className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 shadow-lg max-w-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  {selectedOrderIds.size} Order{selectedOrderIds.size !== 1 ? 's' : ''} selected
                </p>
                <p className="text-xs text-slate-600">
                  Total: £{selectedOrdersTotal.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={clearSelection} size="sm">
                  Clear
                </Button>
                <Button onClick={handleCreateJob} size="sm">
                  Create Job
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Info Panel */}
      {selectedOrderForInfo && (
        <div className="fixed top-4 right-4 z-50">
          <OrderInfoPanel
            order={selectedOrderForInfo}
            isSelected={selectedOrderIds.has(selectedOrderForInfo.id)}
            onToggleSelection={() => handleToggleSelectionFromPanel(selectedOrderForInfo.id)}
            onViewOrder={() => handleViewOrder(selectedOrderForInfo.id)}
            onClose={() => setSelectedOrderForInfo(null)}
          />
        </div>
      )}

      {/* Create Job Drawer */}
      <CreateJobDrawer
        open={isCreateJobDrawerOpen}
        onOpenChange={handleDrawerClose}
        initialOrderIds={Array.from(selectedOrderIds).filter(id => {
          const marker = filteredMarkers.find(m => m.id === id);
          return marker && !marker.isAssigned;
        })}
        initialLocation={firstSelectedOrder?.location || ''}
        onJobCreated={handleJobCreated}
        onError={handleJobCreationError}
      />
    </div>
  );
};

export default JobsMapPage;
