import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/components/ui/table';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Search, Plus, Building2, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { useCompaniesList, type Company } from '../hooks/useCompanies';
import { transformCompaniesFromDb, type UICompany } from '../utils/companyTransform';
import { CreateCompanyDrawer } from '../components/CreateCompanyDrawer';
import { EditCompanyDrawer } from '../components/EditCompanyDrawer';
import { DeleteCompanyDialog } from '../components/DeleteCompanyDialog';

export const CompaniesPage: React.FC = () => {
  const { data: companiesData, isLoading, error, refetch } = useCompaniesList();
  const [searchQuery, setSearchQuery] = useState('');
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);

  const uiCompanies = useMemo<UICompany[]>(() => {
    if (!companiesData) return [];
    return transformCompaniesFromDb(companiesData);
  }, [companiesData]);

  const filteredCompanies = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return uiCompanies;
    return uiCompanies.filter((company) => {
      return (
        company.name.toLowerCase().includes(query) ||
        company.email?.toLowerCase().includes(query) ||
        company.phone?.toLowerCase().includes(query)
      );
    });
  }, [uiCompanies, searchQuery]);

  const handleEdit = (companyId: string) => {
    const dbCompany = companiesData?.find((c) => c.id === companyId);
    if (dbCompany) {
      setCompanyToEdit(dbCompany);
      setEditDrawerOpen(true);
    }
  };

  const handleDelete = (companyId: string) => {
    const dbCompany = companiesData?.find((c) => c.id === companyId);
    if (dbCompany) {
      setCompanyToDelete(dbCompany);
      setDeleteDialogOpen(true);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
              {error instanceof Error ? error.message : 'Failed to load companies.'}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (filteredCompanies.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <Building2 className="h-10 w-10 text-slate-400 mx-auto" />
            <div className="text-lg font-medium">No companies found</div>
            <div className="text-sm text-slate-600">
              {searchQuery ? 'Try adjusting your search.' : 'Create your first company to get started.'}
            </div>
            <Button onClick={() => setCreateDrawerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Company
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Companies ({filteredCompanies.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Team Members</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.email || '-'}</TableCell>
                  <TableCell>{company.phone || '-'}</TableCell>
                  <TableCell>{company.city || '-'}</TableCell>
                  <TableCell>{company.country || '-'}</TableCell>
                  <TableCell>
                    {company.teamMembers.length > 0
                      ? `${company.teamMembers.length} member${company.teamMembers.length !== 1 ? 's' : ''}`
                      : '-'}
                  </TableCell>
                  <TableCell>{formatDate(company.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(company.id)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(company.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage company records and team assignments
          </p>
        </div>
        <Button onClick={() => setCreateDrawerOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Company
        </Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {renderTable()}

      <CreateCompanyDrawer open={createDrawerOpen} onOpenChange={setCreateDrawerOpen} />

      {companyToEdit && (
        <EditCompanyDrawer
          open={editDrawerOpen}
          onOpenChange={(open) => {
            setEditDrawerOpen(open);
            if (!open) setCompanyToEdit(null);
          }}
          company={companyToEdit}
        />
      )}

      {companyToDelete && (
        <DeleteCompanyDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setCompanyToDelete(null);
          }}
          company={companyToDelete}
        />
      )}
    </div>
  );
};

