import React, { useMemo, useState } from 'react';
import { useProductsList } from '@/modules/products/hooks/useProducts';
import { transformProductsFromDb, type UIProduct } from '@/modules/products/utils/productTransform';
import { CreateProductDrawer } from '@/modules/products/components/CreateProductDrawer';
import { EditProductDrawer } from '@/modules/products/components/EditProductDrawer';
import { DeleteProductDialog } from '@/modules/products/components/DeleteProductDialog';
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

export const MemorialsPage: React.FC = () => {
  const { data: productsData, isLoading, error, refetch } = useProductsList();
  const [searchQuery, setSearchQuery] = useState('');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<UIProduct | null>(null);

  const products = useMemo(() => {
    if (!productsData) return [];
    return transformProductsFromDb(productsData);
  }, [productsData]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    if (!searchQuery) return products;
    
    const query = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(query));
  }, [products, searchQuery]);

  const handleEdit = (product: UIProduct) => {
    setSelectedProduct(product);
    setEditDrawerOpen(true);
  };

  const handleDelete = (product: UIProduct) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  if (error) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold">Products</h1>
          <p className="text-muted-foreground">
            Manage your product catalog
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)} className="w-full sm:w-auto">
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
              className="flex-1"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
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
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      {product.name || '—'}
                    </TableCell>
                    <TableCell>
                      {product.price != null ? String(product.price) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(product)}
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

      <CreateProductDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
      />

      {selectedProduct && (
        <>
          <EditProductDrawer
            open={editDrawerOpen}
            onOpenChange={(open) => {
              setEditDrawerOpen(open);
              if (!open) setSelectedProduct(null);
            }}
            product={selectedProduct}
          />

          <DeleteProductDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setSelectedProduct(null);
            }}
            product={selectedProduct}
          />
        </>
      )}
    </div>
  );
};

