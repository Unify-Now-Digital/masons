import React, { useMemo, useState } from 'react';
import { useInscriptionsList } from '../hooks/useInscriptions';
import { transformInscriptionsFromDb } from '../utils/inscriptionTransform';
import { CreateInscriptionDrawer } from '../components/CreateInscriptionDrawer';
import { EditInscriptionDrawer } from '../components/EditInscriptionDrawer';
import { DeleteInscriptionDialog } from '../components/DeleteInscriptionDialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Plus, Pencil, Trash2, Italic } from 'lucide-react';
import InscriptionsDashboard from '../components/InscriptionsDashboard';
import { format } from 'date-fns';
import type { Inscription } from '../hooks/useInscriptions';
import type { UIInscription } from '../utils/inscriptionTransform';

const statusColors: Record<string, string> = {
  pending: 'bg-gray-500',
  proofing: 'bg-yellow-500',
  approved: 'bg-blue-500',
  engraving: 'bg-purple-500',
  completed: 'bg-green-500',
  installed: 'bg-green-600',
};

const formatType = (type: string) => {
  return type.charAt(0).toUpperCase() + type.slice(1);
};

export const InscriptionsPage: React.FC = () => {
  const { data: inscriptionsData, isLoading, error, refetch } = useInscriptionsList();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedInscription, setSelectedInscription] = useState<Inscription | null>(null);

  const inscriptions = useMemo(() => {
    if (!inscriptionsData) return [];
    return transformInscriptionsFromDb(inscriptionsData);
  }, [inscriptionsData]);

  const filteredInscriptions = useMemo(() => {
    if (!inscriptions) return [];
    
    let filtered = inscriptions;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.inscriptionText.toLowerCase().includes(query) ||
          (i.style && i.style.toLowerCase().includes(query)) ||
          (i.engravedBy && i.engravedBy.toLowerCase().includes(query))
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }
    
    return filtered;
  }, [inscriptions, searchQuery, statusFilter]);

  const handleEdit = (inscription: UIInscription) => {
    // Find original DB inscription
    const dbInscription = inscriptionsData?.find((i) => i.id === inscription.id);
    if (dbInscription) {
      setSelectedInscription(dbInscription);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (inscription: UIInscription) => {
    const dbInscription = inscriptionsData?.find((i) => i.id === inscription.id);
    if (dbInscription) {
      setSelectedInscription(dbInscription);
      setDeleteDialogOpen(true);
    }
  };

  const formatEngravedDate = (date: string | null) => {
    if (!date) return 'Not engraved';
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
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive mb-4">Error loading inscriptions</p>
              <Button onClick={() => refetch()}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold">Inscriptions</h1>
          <p className="text-muted-foreground">
            Draft proofs, manage approvals, and track every inscription.
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          New Inscription
        </Button>
      </div>

      <Tabs defaultValue="studio" className="w-full">
        <TabsList>
          <TabsTrigger value="studio">Design Studio</TabsTrigger>
          <TabsTrigger value="all">All Inscriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="studio" className="mt-4">
          <Card className="overflow-hidden p-0">
            <InscriptionsDashboard />
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
      <Card>
        <CardHeader>
          <CardTitle>Inscriptions</CardTitle>
          <CardDescription>View and manage all inscription records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-4">
            <Input
              placeholder="Search by inscription text, style, or engraver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="proofing">Proofing</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="engraving">Engraving</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredInscriptions.length === 0 ? (
            <div className="text-center py-8">
              <Italic className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all'
                  ? 'No inscriptions match your filters'
                  : 'No inscriptions found'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Button onClick={() => setCreateDrawerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Inscription
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto"><Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Engraved By</TableHead>
                  <TableHead>Engraved Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInscriptions.map((inscription) => (
                  <TableRow key={inscription.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {inscription.orderId ? `${inscription.orderId.substring(0, 8)}...` : 'Unlinked'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{formatType(inscription.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={statusColors[inscription.status] || 'bg-gray-500'}
                      >
                        {inscription.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inscription.color ? (
                        <Badge variant="outline">{inscription.color}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {inscription.style || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {inscription.engravedBy || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      {formatEngravedDate(inscription.engravedDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(inscription)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(inscription)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table></div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      <CreateInscriptionDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {selectedInscription && (
        <>
          <EditInscriptionDrawer
            open={editDrawerOpen}
            onOpenChange={(open) => {
              setEditDrawerOpen(open);
              if (!open) setSelectedInscription(null);
            }}
            inscription={selectedInscription}
          />

          <DeleteInscriptionDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setSelectedInscription(null);
            }}
            inscription={selectedInscription}
          />
        </>
      )}
    </div>
  );
};

