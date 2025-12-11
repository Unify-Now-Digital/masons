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
import { useJobsList } from '../hooks/useJobs';
import { transformJobsToMarkers, type MapMarker } from '../utils/mapTransform';
import { useToast } from '@/shared/hooks/use-toast';
import { format } from 'date-fns';

export const JobsMapPage: React.FC = () => {
  const { data: jobsData, isLoading, error, refetch } = useJobsList();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Transform jobs to markers
  const markers = useMemo(() => {
    if (!jobsData) return [];
    return transformJobsToMarkers(jobsData);
  }, [jobsData]);

  // Filter markers based on status and search
  const filteredMarkers = useMemo(() => {
    let filtered = markers;
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(marker => marker.status === statusFilter);
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(marker =>
        marker.customer.toLowerCase().includes(query) ||
        marker.location.toLowerCase().includes(query) ||
        marker.address.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [markers, statusFilter, searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-blue-100 text-blue-700";
      case "in_progress": return "bg-orange-100 text-orange-700";
      case "ready_for_installation": return "bg-green-100 text-green-700";
      case "completed": return "bg-green-100 text-green-700";
      case "cancelled": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getRouteOptimization = () => {
    const readyMarkers = filteredMarkers.filter(marker => marker.status === "ready_for_installation");
    return readyMarkers.sort((a, b) => {
      if (!a.scheduledDate && !b.scheduledDate) return 0;
      if (!a.scheduledDate) return 1;
      if (!b.scheduledDate) return -1;
      return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
    });
  };

  // Error handling
  useEffect(() => {
    if (error) {
      toast({
        title: 'Error loading jobs',
        description: error.message || 'Failed to load job locations',
        variant: 'destructive',
      });
    }
  }, [error, toast]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Map of Jobs</h1>
          <p className="text-sm text-slate-600 mt-1">
            Track job locations and optimize routes
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
                <div className="flex gap-2 items-center">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="ready_for_installation">Ready for Installation</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </div>
              </div>
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
                selectedMarker={selectedJob}
                onMarkerSelect={setSelectedJob}
                isLoading={isLoading}
                error={error}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Tabs value={activeFilter} onValueChange={setActiveFilter}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">All Jobs</TabsTrigger>
              <TabsTrigger value="ready">Ready</TabsTrigger>
            </TabsList>
            
            <TabsContent value={activeFilter} className="space-y-4">
              <h3 className="text-lg font-semibold">
                {activeFilter === "ready" ? "Ready for Installation" : "All Jobs"}
              </h3>
              
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : filteredMarkers.length === 0 ? (
                <div className="text-center py-8 text-slate-600">
                  {searchQuery || statusFilter !== 'all'
                    ? 'No jobs match your filters'
                    : 'No jobs with coordinates found'}
                </div>
              ) : (
                filteredMarkers.map((marker) => (
                  <Card 
                    key={marker.id} 
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedJob === marker.id ? "ring-2 ring-blue-500" : ""
                    }`}
                    onClick={() => setSelectedJob(selectedJob === marker.id ? null : marker.id)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium">{marker.customer}</h4>
                          <p className="text-sm text-slate-600">{marker.location}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={getStatusColor(marker.status)}>
                            {marker.status.replace('_', ' ')}
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
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          <span>Scheduled: {marker.scheduledDate ? format(new Date(marker.scheduledDate), 'MMM dd, yyyy') : 'Not scheduled'}</span>
                        </div>
                        {marker.estimatedDuration && (
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>Est. {marker.estimatedDuration}</span>
                          </div>
                        )}
                      </div>

                      {selectedJob === marker.id && (
                        <div className="mt-4 pt-4 border-t space-y-2">
                          <p className="text-sm text-slate-600">{marker.address}</p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <a href={`/dashboard/jobs/${marker.id}`}>
                                View Job
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Route Optimization</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-3">
                Suggested route for today's installations:
              </p>
              {getRouteOptimization().length > 0 ? (
                <>
                  <div className="space-y-2">
                    {getRouteOptimization().map((marker, index) => (
                      <div key={marker.id} className="flex items-center text-sm">
                        <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mr-2 text-xs">
                          {index + 1}
                        </div>
                        <span>{marker.location}</span>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" className="w-full mt-3">
                    Start Navigation
                  </Button>
                </>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">
                  No ready jobs for route optimization
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default JobsMapPage;
