import React, { useMemo, useState } from 'react';
import { useMemorialsList } from '../hooks/useMemorials';
import { transformMemorialsFromDb } from '../utils/memorialTransform';
import { CreateMemorialDrawer } from '../components/CreateMemorialDrawer';
import { EditMemorialDrawer } from '../components/EditMemorialDrawer';
import { DeleteMemorialDialog } from '../components/DeleteMemorialDialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Plus, Pencil, Trash2, Landmark } from 'lucide-react';
import { format } from 'date-fns';
import type { Memorial } from '../hooks/useMemorials';
import type { UIMemorial } from '../utils/memorialTransform';

const statusColors: Record<string, string> = {
  planned: 'bg-gray-500',
  in_progress: 'bg-blue-500',
  installed: 'bg-green-500',
  removed: 'bg-red-500',
};

export const MemorialsPage: React.FC = () => {
  const { data: memorialsData, isLoading, error, refetch } = useMemorialsList();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMemorial, setSelectedMemorial] = useState<Memorial | null>(null);

  const memorials = useMemo(() => {
    if (!memorialsData) return [];
    return transformMemorialsFromDb(memorialsData);
  }, [memorialsData]);

  const filteredMemorials = useMemo(() => {
    if (!memorials) return [];
    
    let filtered = memorials;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.deceasedName.toLowerCase().includes(query) ||
          m.cemeteryName.toLowerCase().includes(query) ||
          (m.cemeteryPlot && m.cemeteryPlot.toLowerCase().includes(query)) ||
          m.memorialType.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((m) => m.status === statusFilter);
    }
    
    return filtered;
  }, [memorials, searchQuery, statusFilter]);

  const handleEdit = (memorial: UIMemorial) => {
    // Find original DB memorial
    const dbMemorial = memorialsData?.find((m) => m.id === memorial.id);
    if (dbMemorial) {
      setSelectedMemorial(dbMemorial);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (memorial: UIMemorial) => {
    const dbMemorial = memorialsData?.find((m) => m.id === memorial.id);
    if (dbMemorial) {
      setSelectedMemorial(dbMemorial);
      setDeleteDialogOpen(true);
    }
  };

  const formatCemeteryInfo = (memorial: UIMemorial) => {
    if (memorial.cemeterySection && memorial.cemeteryPlot) {
      return `${memorial.cemeteryName} - ${memorial.cemeterySection} ${memorial.cemeteryPlot}`;
    }
    return memorial.cemeteryName;
  };

  const formatInstallationDate = (date: string | null) => {
    if (!date) return 'Not installed';
    try {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return 'Invalid date';
      }
      return format(parsedDate, 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive mb-4">Error loading memorials</p>
              <Button onClick={() => refetch()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Memorials</h1>
          <p className="text-muted-foreground">
            Manage client memorial records for installed/planned memorials
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Memorial
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Memorials</CardTitle>
          <CardDescription>View and manage all memorial records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Input
              placeholder="Search by deceased name, cemetery, plot, or memorial type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="removed">Removed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredMemorials.length === 0 ? (
            <div className="text-center py-8">
              <Landmark className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'No memorials match your filters'
                  : 'No memorials found'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button onClick={() => setCreateDrawerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Memorial
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Deceased</TableHead>
                  <TableHead>Cemetery</TableHead>
                  <TableHead>Memorial Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Installation Date</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMemorials.map((memorial) => (
                  <TableRow key={memorial.id}>
                    <TableCell className="font-medium">
                      {memorial.deceasedName}
                    </TableCell>
                    <TableCell>{formatCemeteryInfo(memorial)}</TableCell>
                    <TableCell>{memorial.memorialType}</TableCell>
                    <TableCell>
                      <Badge
                        className={statusColors[memorial.status] || 'bg-gray-500'}
                      >
                        {memorial.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatInstallationDate(memorial.installationDate)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {memorial.orderId.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(memorial)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(memorial)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateMemorialDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {selectedMemorial && (
        <>
          <EditMemorialDrawer
            open={editDrawerOpen}
            onOpenChange={(open) => {
              setEditDrawerOpen(open);
              if (!open) setSelectedMemorial(null);
            }}
            memorial={selectedMemorial}
          />

          <DeleteMemorialDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setSelectedMemorial(null);
            }}
            memorial={selectedMemorial}
          />
        </>
      )}
    </div>
  );
};

