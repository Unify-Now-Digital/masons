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
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { UserCog, X } from 'lucide-react';
import { Search, Plus, Hammer, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { useJobsList, type Job } from '../hooks/useJobs';
import { transformJobsFromDb, type UIJob } from '../utils/jobTransform';
import { CreateJobDrawer } from '../components/CreateJobDrawer';
import { EditJobDrawer } from '../components/EditJobDrawer';
import { DeleteJobDialog } from '../components/DeleteJobDialog';
import { useWorkers, useWorkersByJobs } from '@/modules/workers/hooks/useWorkers';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { format } from 'date-fns';
import { ProofApprovalBadge, useProofsByOrders } from '@/modules/proofs';

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'scheduled':
      return 'bg-gardens-blu-lt text-gardens-blu-dk';
    case 'in_progress':
      return 'bg-gardens-amb-lt text-gardens-amb-dk';
    case 'ready_for_installation':
      return 'bg-gardens-grn-lt text-gardens-grn-dk';
    case 'completed':
      return 'bg-gardens-page text-gardens-tx';
    case 'cancelled':
      return 'bg-gardens-red-lt text-gardens-red-dk';
    default:
      return 'bg-gardens-page text-gardens-tx';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high':
      return 'text-gardens-red-dk';
    case 'medium':
      return 'text-gardens-amb-dk';
    case 'low':
      return 'text-gardens-grn-dk';
    default:
      return 'text-gardens-tx';
  }
};

const formatStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export const JobsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToEdit, setJobToEdit] = useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  
  const { data: jobsData, isLoading, error, refetch } = useJobsList({
    workerIds: selectedWorkerIds.length > 0 ? selectedWorkerIds : undefined,
  });
  const { data: workers } = useWorkers({ activeOnly: true });

  // Guard jobsData to always be an array
  const jobs = useMemo(() => jobsData || [], [jobsData]);

  const uiJobs = useMemo<UIJob[]>(() => {
    if (!jobs || jobs.length === 0) return [];
    return transformJobsFromDb(jobs);
  }, [jobs]);

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

  // Fetch workers for visible jobs (batch fetch)
  const jobIds = useMemo(() => filteredJobs.map(j => j.id), [filteredJobs]);
  const { data: workersByJobId, isLoading: isLoadingWorkers } = useWorkersByJobs(jobIds);

  // Batch-fetch proofs for visible jobs — single query, no N+1 (T022 fix)
  const orderIdsForProofs = useMemo(
    () => filteredJobs.map(j => j.orderId).filter((id): id is string => !!id),
    [filteredJobs],
  );
  const { data: proofMap } = useProofsByOrders(orderIdsForProofs);

  const handleEdit = (jobId: string) => {
    const dbJob = jobs.find((j) => j.id === jobId);
    if (dbJob) {
      setJobToEdit(dbJob);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (jobId: string) => {
    const dbJob = jobs.find((j) => j.id === jobId);
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
            <div className="text-gardens-red-dk">
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
            <Hammer className="h-10 w-10 text-gardens-txs mx-auto" />
            <div className="text-lg font-medium">No jobs found</div>
            <div className="text-sm text-gardens-tx">
              {searchQuery || statusFilter !== 'all' || selectedWorkerIds.length > 0
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
      <div className="overflow-x-auto"><Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Proof</TableHead>
            <TableHead>Scheduled Date</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Workers</TableHead>
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
                {job.orderId ? (
                  <ProofApprovalBadge proof={proofMap[job.orderId] ?? null} size="sm" />
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
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
              <TableCell>
                {isLoadingWorkers ? (
                  <Skeleton className="h-6 w-20" />
                ) : (() => {
                  const workers = workersByJobId?.[job.id] ?? [];
                  if (workers.length === 0) {
                    return <span className="text-muted-foreground">—</span>;
                  }
                  
                  return (
                    <div className="flex flex-wrap gap-1">
                      {workers.slice(0, 3).map((worker) => {
                        const initials = worker.full_name
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2);
                        return (
                          <Tooltip key={worker.id}>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="h-6 px-2 text-xs">
                                <span className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center text-[10px] mr-1">
                                  {initials}
                                </span>
                                {worker.full_name}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {worker.full_name} ({worker.role})
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                      {workers.length > 3 && (
                        <Badge variant="outline" className="h-6 px-2 text-xs">
                          +{workers.length - 3} more
                        </Badge>
                      )}
                    </div>
                  );
                })()}
              </TableCell>
              <TableCell>{job.estimatedDuration || '-'}</TableCell>
              <TableCell className="text-sm text-gardens-tx">
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
                    <Trash2 className="h-4 w-4 text-gardens-red-dk" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Jobs</h1>
          <p className="text-sm text-gardens-tx mt-1">
            Manage installation jobs and schedules
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job List</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer, address, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
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
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[180px] justify-start">
                  <UserCog className="h-4 w-4 mr-2" />
                  {selectedWorkerIds.length > 0
                    ? `${selectedWorkerIds.length} worker${selectedWorkerIds.length !== 1 ? 's' : ''}`
                    : 'Filter by worker'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="end">
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Filter by Worker</h4>
                    {selectedWorkerIds.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedWorkerIds([])}
                        className="h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <div className="border rounded-md p-2 max-h-60 overflow-y-auto space-y-2">
                    {!workers || workers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No workers available</p>
                    ) : (
                      workers.map((worker) => (
                        <div key={worker.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`filter-worker-${worker.id}`}
                            checked={selectedWorkerIds.includes(worker.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedWorkerIds([...selectedWorkerIds, worker.id]);
                              } else {
                                setSelectedWorkerIds(selectedWorkerIds.filter(id => id !== worker.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`filter-worker-${worker.id}`}
                            className="text-sm font-medium leading-none cursor-pointer flex-1"
                          >
                            {worker.full_name} ({worker.role})
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            </div>
          </div>
          {selectedWorkerIds.length > 0 && workers && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedWorkerIds.map((workerId) => {
                const worker = workers?.find(w => w.id === workerId);
                if (!worker) return null;
                return (
                  <Badge key={workerId} variant="secondary" className="gap-1">
                    {worker.full_name}
                    <button
                      onClick={() => setSelectedWorkerIds(selectedWorkerIds.filter(id => id !== workerId))}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
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

