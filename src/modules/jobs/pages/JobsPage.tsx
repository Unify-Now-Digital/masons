import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Search, Plus, Hammer, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { useJobsList, type Job } from '../hooks/useJobs';
import { transformJobsFromDb, type UIJob } from '../utils/jobTransform';
import { CreateJobDrawer } from '../components/CreateJobDrawer';
import { EditJobDrawer } from '../components/EditJobDrawer';
import { DeleteJobDialog } from '../components/DeleteJobDialog';
import { format } from 'date-fns';

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-700';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-700';
    case 'ready_for_installation':
      return 'bg-green-100 text-green-700';
    case 'completed':
      return 'bg-gray-100 text-gray-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'text-red-600';
    case 'medium':
      return 'text-yellow-600';
    case 'low':
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
};

const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export const JobsPage: React.FC = () => {
  const { data: jobsData, isLoading, error, refetch } = useJobsList();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);

  const uiJobs = useMemo<UIJob[]>(() => {
    if (!jobsData) return [];
    return transformJobsFromDb(jobsData);
  }, [jobsData]);

  const filteredJobs = useMemo(() => {
    let filtered = uiJobs;

    // Search filter
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      filtered = filtered.filter((job) => {
        return (
          job.customerName.toLowerCase().includes(query) ||
          job.address.toLowerCase().includes(query) ||
          job.locationName.toLowerCase().includes(query)
        );
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((job) => job.status === statusFilter);
    }

    return filtered;
  }, [uiJobs, searchQuery, statusFilter]);

  const handleEdit = (jobId: string) => {
    const dbJob = jobsData?.find((j) => j.id === jobId);
    if (dbJob) {
      setJobToEdit(dbJob);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (jobId: string) => {
    const dbJob = jobsData?.find((j) => j.id === jobId);
    if (dbJob) {
      setJobToDelete(dbJob);
      setDeleteDialogOpen(true);
    }
  };

  const renderTable = () => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <Card>
          <CardContent className="py-6 flex items-center justify-between">
            <div className="text-red-600">
              {error instanceof Error ? error.message : 'Failed to load jobs.'}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (filteredJobs.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <Hammer className="h-10 w-10 text-slate-400 mx-auto" />
            <div className="text-lg font-medium">No jobs found</div>
            <div className="text-sm text-slate-600">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Create your first job to get started.'}
            </div>
            {!searchQuery && statusFilter === 'all' && (
              <Button onClick={() => setCreateDrawerOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Scheduled Date</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredJobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium">{job.customerName}</TableCell>
              <TableCell>{job.locationName}</TableCell>
              <TableCell className="max-w-[200px] truncate">{job.address}</TableCell>
              <TableCell>
                <Badge className={getStatusBadgeColor(job.status)}>
                  {formatStatus(job.status)}
                </Badge>
              </TableCell>
              <TableCell>
                {job.scheduledDate ? (() => {
                  try {
                    const date = new Date(job.scheduledDate);
                    if (isNaN(date.getTime())) {
                      return 'Invalid date';
                    }
                    return format(date, 'MMM dd, yyyy');
                  } catch {
                    return 'Invalid date';
                  }
                })() : 'Not scheduled'}
              </TableCell>
              <TableCell>
                <span className={getPriorityColor(job.priority)}>
                  {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
                </span>
              </TableCell>
              <TableCell>{job.estimatedDuration || '-'}</TableCell>
              <TableCell className="text-sm text-slate-600">
                {(() => {
                  try {
                    const date = new Date(job.createdAt);
                    if (isNaN(date.getTime())) {
                      return 'Invalid date';
                    }
                    return format(date, 'MMM dd, yyyy');
                  } catch {
                    return 'Invalid date';
                  }
                })()}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(job.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(job.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage installation jobs and schedules
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, address, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
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
          </div>
          {renderTable()}
        </CardContent>
      </Card>

      <CreateJobDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />
      {jobToEdit && (
        <EditJobDrawer
          open={editDrawerOpen}
          onOpenChange={setEditDrawerOpen}
          job={jobToEdit}
        />
      )}
      {jobToDelete && (
        <DeleteJobDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          job={jobToDelete}
        />
      )}
    </div>
  );
};

