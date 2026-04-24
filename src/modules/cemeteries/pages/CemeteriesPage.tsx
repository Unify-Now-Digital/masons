import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Mail, Phone, FileText, Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { useCemeteriesList, type Cemetery, type CemeteryWithCounts } from '../hooks/useCemeteries';
import { CreateCemeteryDrawer } from '../components/CreateCemeteryDrawer';
import { EditCemeteryDrawer } from '../components/EditCemeteryDrawer';
import { DeleteCemeteryDialog } from '../components/DeleteCemeteryDialog';

export const CemeteriesPage: React.FC = () => {
  const { data: cemeteries, isLoading, error } = useCemeteriesList();
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Cemetery | null>(null);
  const [deleting, setDeleting] = useState<CemeteryWithCounts | null>(null);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cemeteries ?? [];
    return (cemeteries ?? []).filter((c) =>
      [c.name, c.primary_email, c.phone, c.address]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [cemeteries, query]);

  const totalOrders = useMemo(
    () => (cemeteries ?? []).reduce((sum, c) => sum + c.orderCount, 0),
    [cemeteries]
  );

  if (error) {
    return (
      <div className="text-gardens-red">
        Error loading cemeteries: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="font-head text-xl sm:text-2xl font-semibold text-gardens-tx tracking-tight">
            Cemeteries
          </h1>
          <p className="text-sm text-gardens-txs mt-1">
            {isLoading
              ? 'Loading…'
              : `${cemeteries?.length ?? 0} cemeter${(cemeteries?.length ?? 0) === 1 ? 'y' : 'ies'} · ${totalOrders} linked order${totalOrders === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gardens-txs" />
            <Input
              placeholder="Search name, email, address..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="whitespace-nowrap">
            <Plus className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">New cemetery</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">All cemeteries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto min-w-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Address</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Approval</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Permit forms</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-gardens-txs">
                      Loading cemeteries…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-gardens-txs">
                      {cemeteries?.length === 0
                        ? 'No cemeteries yet. Click "New cemetery" to add one.'
                        : 'No matches.'}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((c) => (
                  <CemeteryRow
                    key={c.id}
                    cemetery={c}
                    onOpenOrders={() => navigate(`/dashboard/orders?cemetery=${c.id}`)}
                    onEdit={() => setEditing(c)}
                    onDelete={() => setDeleting(c)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateCemeteryDrawer open={createOpen} onOpenChange={setCreateOpen} />
      {editing && (
        <EditCemeteryDrawer
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          cemetery={editing}
        />
      )}
      {deleting && (
        <DeleteCemeteryDialog
          open={!!deleting}
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          cemetery={deleting}
        />
      )}
    </div>
  );
};

interface RowProps {
  cemetery: CemeteryWithCounts;
  onOpenOrders: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const CemeteryRow: React.FC<RowProps> = ({ cemetery, onOpenOrders, onEdit, onDelete }) => (
  <TableRow
    className="cursor-pointer hover:bg-gardens-page/60"
    onClick={onOpenOrders}
  >
    <TableCell className="font-medium">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-gardens-txs shrink-0" />
        <span className="truncate">{cemetery.name}</span>
      </div>
    </TableCell>
    <TableCell className="hidden md:table-cell text-gardens-txs">
      <div className="flex flex-col gap-0.5 text-xs">
        {cemetery.primary_email && (
          <span className="inline-flex items-center gap-1 truncate">
            <Mail className="h-3 w-3 shrink-0" />
            {cemetery.primary_email}
          </span>
        )}
        {cemetery.phone && (
          <span className="inline-flex items-center gap-1 truncate">
            <Phone className="h-3 w-3 shrink-0" />
            {cemetery.phone}
          </span>
        )}
        {!cemetery.primary_email && !cemetery.phone && <span className="text-gardens-txm">—</span>}
      </div>
    </TableCell>
    <TableCell className="hidden lg:table-cell text-gardens-txs truncate max-w-[220px]">
      {cemetery.address || <span className="text-gardens-txm">—</span>}
    </TableCell>
    <TableCell className="text-right tabular-nums hidden sm:table-cell">
      {cemetery.avg_approval_days != null ? (
        <span>
          {cemetery.avg_approval_days}
          <span className="text-gardens-txm ml-0.5">d</span>
        </span>
      ) : (
        <span className="text-gardens-txm">—</span>
      )}
    </TableCell>
    <TableCell className="text-right tabular-nums">
      {cemetery.orderCount > 0 ? cemetery.orderCount : <span className="text-gardens-txm">0</span>}
    </TableCell>
    <TableCell className="text-right tabular-nums hidden md:table-cell">
      {cemetery.permitFormCount > 0 ? (
        <span className="inline-flex items-center gap-1 text-gardens-blu-dk">
          <FileText className="h-3 w-3" />
          {cemetery.permitFormCount}
        </span>
      ) : (
        <span className="text-gardens-txm">0</span>
      )}
    </TableCell>
    <TableCell
      className="text-right space-x-1 whitespace-nowrap"
      onClick={(e) => e.stopPropagation()}
    >
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">Edit</span>
      </Button>
      <Button variant="destructive" size="sm" onClick={onDelete}>
        <Trash2 className="h-4 w-4 sm:mr-1" />
        <span className="hidden sm:inline">Delete</span>
      </Button>
    </TableCell>
  </TableRow>
);
