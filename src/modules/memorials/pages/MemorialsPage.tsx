import React, { useMemo, useState } from 'react';
import { useMemorialsList } from '../hooks/useMemorials';
import { transformMemorialsFromDb } from '../utils/memorialTransform';
import { CreateMemorialDrawer } from '../components/CreateMemorialDrawer';
import { EditMemorialDrawer } from '../components/EditMemorialDrawer';
import { DeleteMemorialDialog } from '../components/DeleteMemorialDialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Plus, Pencil, Trash2, Landmark } from 'lucide-react';
import type { Memorial } from '../hooks/useMemorials';
import type { UIMemorial } from '../utils/memorialTransform';

export const MemorialsPage: React.FC = () => {
  const { data: memorialsData, isLoading, error, refetch } = useMemorialsList();
  const [searchQuery, setSearchQuery] = useState('');
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
    
    if (!searchQuery) return memorials;
    
    const query = searchQuery.toLowerCase();
    return memorials.filter((m) => {
      const productName = (m as any).name || m.memorialType || '';
      return productName.toLowerCase().includes(query);
    });
  }, [memorials, searchQuery]);

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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-destructive mb-4">Error loading products</p>
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
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>View and manage your product catalog</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
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
                {searchQuery
                  ? 'No products match your search'
                  : 'No products found. Create your first product to get started.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setCreateDrawerOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Product
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMemorials.map((memorial) => (
                  <TableRow key={memorial.id}>
                    <TableCell className="font-medium">
                      {(() => {
                        const productName = (memorial as any).name || memorial.memorialType;
                        return productName?.trim() || '—';
                      })()}
                    </TableCell>
                    <TableCell>
                      {memorial.price != null ? String(memorial.price) : '—'}
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

