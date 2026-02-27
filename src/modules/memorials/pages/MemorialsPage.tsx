import React, { useMemo, useState } from 'react';
import { useMemorialsList } from '../hooks/useMemorials';
import { transformMemorialsFromDb } from '../utils/memorialTransform';
import { CreateMemorialDrawer } from '../components/CreateMemorialDrawer';
import { EditMemorialDrawer } from '../components/EditMemorialDrawer';
import { DeleteMemorialDialog } from '../components/DeleteMemorialDialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
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
          <div className="flex items-center gap-4 mb-6">
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-lg" />
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredMemorials.map((memorial) => {
                const productName = memorial.name || memorial.memorialType;
                const displayName = productName?.trim() || 'Untitled Product';
                const photoUrl = memorial.photoUrl;

                return (
                  <div
                    key={memorial.id}
                    className="group relative border rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow"
                  >
                    {/* Product Image */}
                    <div className="aspect-[4/5] bg-muted flex items-center justify-center overflow-hidden">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={displayName}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={photoUrl ? 'hidden' : 'flex flex-col items-center justify-center text-muted-foreground'}>
                        <Landmark className="h-12 w-12 mb-2 opacity-30" />
                        <span className="text-xs opacity-50">No image</span>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="p-3">
                      <h3 className="font-medium text-sm truncate" title={displayName}>
                        {displayName}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {memorial.price != null
                          ? `£${Number(memorial.price).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
                          : 'Price on request'}
                      </p>
                    </div>

                    {/* Hover Actions */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 shadow-sm"
                        onClick={() => handleEdit(memorial)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 shadow-sm"
                        onClick={() => handleDelete(memorial)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
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
