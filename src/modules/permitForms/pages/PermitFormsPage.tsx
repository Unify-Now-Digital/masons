import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Search, Plus, RefreshCw, Pencil, Trash2, ExternalLink, Italic } from 'lucide-react';
import { usePermitForms } from '../hooks/usePermitForms';
import type { PermitForm } from '../api/permitForms.api';
import { CreatePermitFormDrawer } from '../components/CreatePermitFormDrawer';
import { EditPermitFormDrawer } from '../components/EditPermitFormDrawer';
import { DeletePermitFormDialog } from '../components/DeletePermitFormDialog';
import { formatDateDMY } from '@/shared/lib/formatters';

function formatDate(dateString: string) {
  return formatDateDMY(dateString);
}

export const PermitFormsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading, error, refetch } = usePermitForms(searchQuery);

  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState<PermitForm | null>(null);

  const permitForms = useMemo(() => data || [], [data]);

  const handleEdit = (permitForm: PermitForm) => {
    setSelected(permitForm);
    setEditDrawerOpen(true);
  };

  const handleDelete = (permitForm: PermitForm) => {
    setSelected(permitForm);
    setDeleteDialogOpen(true);
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
              {error instanceof Error ? error.message : 'Failed to load permit forms.'}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (!permitForms || permitForms.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <Italic className="h-10 w-10 text-gardens-txs mx-auto" />
            <div className="text-lg font-medium">No permit forms found</div>
            <div className="text-sm text-gardens-tx">
              {searchQuery ? 'Try adjusting your search.' : 'Create your first permit form to get started.'}
            </div>
            <Button onClick={() => setCreateDrawerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Permit Form
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[360px]">Name</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permitForms.map((pf) => (
              <TableRow key={pf.id}>
                <TableCell
                  className="font-medium max-w-[360px] truncate"
                  title={pf.name}
                >
                  {pf.name}
                </TableCell>
                <TableCell>
                  {pf.link ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(pf.link as string, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[320px] truncate">
                  {pf.note || '—'}
                </TableCell>
                <TableCell>{pf.created_at ? formatDate(pf.created_at) : '—'}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(pf)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(pf)}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Permit Forms</h1>
          <p className="text-sm text-gardens-tx mt-1">Manage permit form references for orders.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-full md:w-64">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gardens-txs" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setCreateDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Permit Form
          </Button>
        </div>
      </div>

      {renderTable()}

      <CreatePermitFormDrawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen} />

      {selected && (
        <EditPermitFormDrawer
          open={editDrawerOpen}
          onOpenChange={(open) => {
            setEditDrawerOpen(open);
            if (!open) setSelected(null);
          }}
          permitForm={selected}
        />
      )}

      {selected && (
        <DeletePermitFormDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setSelected(null);
          }}
          permitForm={selected}
        />
      )}
    </div>
  );
};

