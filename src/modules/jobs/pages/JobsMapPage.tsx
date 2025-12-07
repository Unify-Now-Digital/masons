import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { MapPin, Calendar, Clock, Navigation, Filter, Route, Search } from 'lucide-react';
import { Input } from "@/shared/components/ui/input";
import { GoogleMap } from "../components/GoogleMap";

// Demo data - will be replaced with real Supabase queries
const jobs = [
  {
    id: "ORD-001",
    customer: "John Smith",
    location: "Oak Hill Cemetery",
    address: "123 Cemetery Rd, Springfield",
    coordinates: { lat: 40.7128, lng: -74.0060 },
    status: "in_progress",
    dueDate: "2025-06-15",
    type: "Granite Headstone",
    estimatedTime: "2 hours",
    priority: "high"
  },
  {
    id: "ORD-002",
    customer: "Sarah Johnson",
    location: "Greenwood Memorial Park",
    address: "456 Memorial Ave, Springfield",
    coordinates: { lat: 40.7589, lng: -73.9851 },
    status: "ready_for_installation",
    dueDate: "2025-06-10",
    type: "Marble Memorial",
    estimatedTime: "4 hours",
    priority: "medium"
  },
  {
    id: "ORD-003",
    customer: "Mike Brown",
    location: "Sunset Cemetery",
    address: "789 Sunset Blvd, Springfield",
    coordinates: { lat: 40.7831, lng: -73.9712 },
    status: "awaiting_approval",
    dueDate: "2025-06-20",
    type: "Bronze Plaque",
    estimatedTime: "1 hour",
    priority: "low"
  }
];

export const JobsMapPage: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress": return "bg-blue-100 text-blue-700";
      case "ready_for_installation": return "bg-green-100 text-green-700";
      case "awaiting_approval": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getRouteOptimization = () => {
    const readyJobs = jobs.filter(job => job.status === "ready_for_installation");
    return readyJobs.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = searchQuery === "" || 
      job.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (activeFilter === "all") return true;
    if (activeFilter === "ready") return job.status === "ready_for_installation";
    if (activeFilter === "urgent") return job.priority === "high";
    return job.status === activeFilter;
  });

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
                <div className="flex gap-2">
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
                jobs={filteredJobs}
                selectedJob={selectedJob}
                onJobSelect={setSelectedJob}
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
              
              {filteredJobs.map((job) => (
                <Card 
                  key={job.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedJob === job.id ? "ring-2 ring-blue-500" : ""
                  }`}
                  onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                >
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{job.customer}</h4>
                        <p className="text-sm text-slate-600">{job.type}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getStatusColor(job.status)}>
                          {job.status.replace('_', ' ')}
                        </Badge>
                        {job.priority === "high" && (
                          <Badge variant="destructive">Urgent</Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span>{job.location}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        <span>Due: {job.dueDate}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        <span>Est. {job.estimatedTime}</span>
                      </div>
                    </div>

                    {selectedJob === job.id && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <p className="text-sm text-slate-600">{job.address}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Navigation className="h-3 w-3 mr-1" />
                            Directions
                          </Button>
                          <Button size="sm" variant="outline">
                            Call Customer
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
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
              <div className="space-y-2">
                {getRouteOptimization().map((job, index) => (
                  <div key={job.id} className="flex items-center text-sm">
                    <div className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center mr-2 text-xs">
                      {index + 1}
                    </div>
                    <span>{job.location}</span>
                  </div>
                ))}
              </div>
              <Button size="sm" className="w-full mt-3">
                Start Navigation
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default JobsMapPage;

