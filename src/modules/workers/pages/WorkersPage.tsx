import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Search, Plus, RefreshCw, Pencil, Trash2, UserCog } from 'lucide-react';
import { useWorkers, type Worker } from '../hooks/useWorkers';
import { CreateWorkerDrawer } from '../components/CreateWorkerDrawer';
import { EditWorkerDrawer } from '../components/EditWorkerDrawer';
import { DeleteWorkerDialog } from '../components/DeleteWorkerDialog';

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'installer':
      return 'bg-blue-100 text-blue-700';
    case 'driver':
      return 'bg-green-100 text-green-700';
    case 'stonecutter':
      return 'bg-purple-100 text-purple-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const formatRole = (role: string) => {
  return role.charAt(0).toUpperCase() + role.slice(1);
};

export const WorkersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState<Worker | null>(null);
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);

  const { data: workersData, isLoading, error, refetch } = useWorkers({
    search: searchQuery || undefined,
    activeOnly,
  });

  const handleEdit = (workerId: string) => {
    const worker = workersData?.find((w) => w.id === workerId);
    if (worker) {
      setWorkerToEdit(worker);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (workerId: string) => {
    const worker = workersData?.find((w) => w.id === workerId);
    if (worker) {
      setWorkerToDelete(worker);
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
              {error instanceof Error ? error.message : 'Failed to load workers.'}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!workersData || workersData.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <UserCog className="h-10 w-10 text-slate-400 mx-auto" />
            <div className="text-lg font-medium">No workers found</div>
            <div className="text-sm text-slate-600">
              {searchQuery ? 'Try adjusting your search.' : 'Create your first worker to get started.'}
            </div>
            <Button onClick={() => setCreateDrawerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Worker
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="overflow-x-auto min-w-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workersData.map((worker) => (
            <TableRow key={worker.id}>
              <TableCell className="font-medium">{worker.full_name}</TableCell>
              <TableCell>
                <Badge className={getRoleBadgeColor(worker.role)}>
                  {formatRole(worker.role)}
                </Badge>
              </TableCell>
              <TableCell>{worker.phone || '-'}</TableCell>
              <TableCell>
                <Badge variant={worker.is_active ? 'default' : 'secondary'}>
                  {worker.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(worker.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(worker.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Workers</h1>
          <p className="text-sm text-slate-600 mt-1">Manage your team members and their assignments</p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Worker
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>All Workers</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active-only"
                  checked={activeOnly}
                  onCheckedChange={(checked) => setActiveOnly(checked === true)}
                />
                <label
                  htmlFor="active-only"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Active only
                </label>
              </div>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>{renderTable()}</CardContent>
      </Card>

      <CreateWorkerDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {workerToEdit && (
        <EditWorkerDrawer
          open={editDrawerOpen}
          onOpenChange={setEditDrawerOpen}
          worker={workerToEdit}
        />
      )}

      {workerToDelete && (
        <DeleteWorkerDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          worker={workerToDelete}
        />
      )}
    </div>
  );
};

