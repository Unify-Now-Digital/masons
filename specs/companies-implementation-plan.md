# Detailed Implementation Plan: Companies Module (Phase 1)

**Branch:** `feature/companies-crud-integration`  
**Specification:** `specs/companies-crud-integration-plan.md`  
**Implementation Plan:** `specs/companies-implementation-plan.md`

---

## Overview

This plan provides step-by-step implementation details for the Companies module, following the same architecture as Customers, Orders, and Invoicing modules. All code examples use TypeScript, React Hook Form, Zod validation, and TanStack Query.

---

## Task 1: Create Company Schema

**File:** `src/modules/companies/schemas/company.schema.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import { z } from 'zod';

export const companyFormSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required'),
  address: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().optional().or(z.literal('')),
  country: z.string().trim().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  team_members: z.array(z.string().trim()).optional().default([]),
  notes: z.string().trim().optional().or(z.literal('')),
});

export type CompanyFormData = z.infer<typeof companyFormSchema>;
```

**Key Points:**
- `name` is required with min length 1
- Optional fields allow empty strings (normalized to `null` in transforms)
- `team_members` is an array of strings, defaults to empty array
- Email validation only applies when non-empty

---

## Task 2: Create Data Transformation Utils

**File:** `src/modules/companies/utils/companyTransform.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import type { Company, CompanyInsert, CompanyUpdate } from '../hooks/useCompanies';
import type { CompanyFormData } from '../schemas/company.schema';

// UI-friendly company format (camelCase)
export interface UICompany {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  teamMembers: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transform database company to UI-friendly format
 */
export function transformCompanyFromDb(company: Company): UICompany {
  return {
    id: company.id,
    name: company.name,
    address: company.address || '',
    city: company.city || '',
    country: company.country || '',
    phone: company.phone || '',
    email: company.email || '',
    teamMembers: company.team_members || [],
    notes: company.notes || '',
    createdAt: company.created_at,
    updatedAt: company.updated_at,
  };
}

/**
 * Transform array of database companies to UI format
 */
export function transformCompaniesFromDb(companies: Company[]): UICompany[] {
  return companies.map(transformCompanyFromDb);
}

/**
 * Convert form data to database insert payload
 */
export function toCompanyInsert(form: CompanyFormData): CompanyInsert {
  return {
    name: form.name,
    address: form.address || null,
    city: form.city || null,
    country: form.country || null,
    phone: form.phone || null,
    email: form.email || null,
    team_members: form.team_members || [],
    notes: form.notes || null,
  };
}

/**
 * Convert form data to database update payload
 */
export function toCompanyUpdate(form: CompanyFormData): CompanyUpdate {
  return {
    name: form.name,
    address: form.address || null,
    city: form.city || null,
    country: form.country || null,
    phone: form.phone || null,
    email: form.email || null,
    team_members: form.team_members || [],
    notes: form.notes || null,
  };
}

/**
 * Parse team members string (comma/newline-separated) to array
 */
export function parseTeamMembers(input: string): string[] {
  if (!input.trim()) return [];
  return input
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * Format team members array to comma-separated string
 */
export function formatTeamMembers(members: string[]): string {
  return members.join(', ');
}
```

**Key Points:**
- `team_members` (DB) ↔ `teamMembers` (UI) conversion
- Empty strings normalized to `null` for optional fields
- Helper functions for parsing/formatting team members textarea input

---

## Task 3: Create CRUD Hooks

**File:** `src/modules/companies/hooks/useCompanies.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';

export interface Company {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  team_members: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CompanyInsert = Omit<Company, 'id' | 'created_at' | 'updated_at'>;
export type CompanyUpdate = Partial<CompanyInsert>;

export const companiesKeys = {
  all: ['companies'] as const,
  detail: (id: string) => ['companies', id] as const,
};

async function fetchCompanies() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Company[];
}

async function fetchCompany(id: string) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Company;
}

async function createCompany(payload: CompanyInsert) {
  const { data, error } = await supabase
    .from('companies')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as Company;
}

async function updateCompany(id: string, updates: CompanyUpdate) {
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Company;
}

async function deleteCompany(id: string) {
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) throw error;
}

export function useCompaniesList() {
  return useQuery({
    queryKey: companiesKeys.all,
    queryFn: fetchCompanies,
  });
}

export function useCompany(id: string) {
  return useQuery({
    queryKey: companiesKeys.detail(id),
    queryFn: () => fetchCompany(id),
    enabled: !!id,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CompanyInsert) => createCompany(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: CompanyUpdate }) =>
      updateCompany(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
      queryClient.setQueryData(companiesKeys.detail(data.id), data);
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companiesKeys.all });
    },
  });
}
```

**Key Points:**
- Query keys follow TanStack Query patterns
- All mutations invalidate list query for automatic refresh
- Update mutation also sets detail cache
- Error handling throws errors (handled by React Query)

---

## Task 4: Create CreateCompanyDrawer Component

**File:** `src/modules/companies/components/CreateCompanyDrawer.tsx`  
**Action:** CREATE

**Complete Code:**

```typescript
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Button } from '@/shared/components/ui/button';
import { useCreateCompany } from '../hooks/useCompanies';
import { companyFormSchema, type CompanyFormData } from '../schemas/company.schema';
import { toCompanyInsert, parseTeamMembers } from '../utils/companyTransform';
import { useToast } from '@/shared/hooks/use-toast';

interface CreateCompanyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateCompanyDrawer: React.FC<CreateCompanyDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createCompany, isPending } = useCreateCompany();
  const { toast } = useToast();

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      country: '',
      phone: '',
      email: '',
      team_members: [],
      notes: '',
    },
  });

  const onSubmit = (values: CompanyFormData) => {
    const payload = toCompanyInsert(values);
    createCompany(payload, {
      onSuccess: () => {
        toast({
          title: 'Company created',
          description: 'Company has been created successfully.',
        });
        form.reset();
        onOpenChange(false);
      },
      onError: (error: Error) => {
        toast({
          title: 'Error creating company',
          description: error?.message || 'Failed to create company.',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Create Company</DrawerTitle>
          <DrawerDescription>Add a new company record.</DrawerDescription>
        </DrawerHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corporation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+44 123 456 7890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="London" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="United Kingdom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="team_members"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Team Members</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter names separated by commas or new lines (e.g., John Doe, Jane Smith)"
                        rows={4}
                        value={field.value.join(', ')}
                        onChange={(e) => {
                          const parsed = parseTeamMembers(e.target.value);
                          field.onChange(parsed);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Separate names with commas or new lines
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DrawerFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating...' : 'Create Company'}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};
```

**Key Points:**
- Team members handled as textarea with comma/newline parsing
- Form state stores array, UI displays as comma-separated string
- Loading state on submit button
- Toast notifications for success/error

---

## Task 5: Create EditCompanyDrawer Component

**File:** `src/modules/companies/components/EditCompanyDrawer.tsx`  
**Action:** CREATE

**Complete Code:**

```typescript
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Button } from '@/shared/components/ui/button';
import { useUpdateCompany, type Company } from '../hooks/useCompanies';
import { companyFormSchema, type CompanyFormData } from '../schemas/company.schema';
import { toCompanyUpdate, parseTeamMembers, formatTeamMembers } from '../utils/companyTransform';
import { useToast } from '@/shared/hooks/use-toast';

interface EditCompanyDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
}

export const EditCompanyDrawer: React.FC<EditCompanyDrawerProps> = ({
  open,
  onOpenChange,
  company,
}) => {
  const { mutate: updateCompany, isPending } = useUpdateCompany();
  const { toast } = useToast();

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: {
      name: company.name,
      address: company.address || '',
      city: company.city || '',
      country: company.country || '',
      phone: company.phone || '',
      email: company.email || '',
      team_members: company.team_members || [],
      notes: company.notes || '',
    },
  });

  useEffect(() => {
    if (open && company) {
      form.reset({
        name: company.name,
        address: company.address || '',
        city: company.city || '',
        country: company.country || '',
        phone: company.phone || '',
        email: company.email || '',
        team_members: company.team_members || [],
        notes: company.notes || '',
      });
    }
  }, [open, company, form]);

  const onSubmit = (values: CompanyFormData) => {
    const payload = toCompanyUpdate(values);
    updateCompany(
      { id: company.id, updates: payload },
      {
        onSuccess: () => {
          toast({
            title: 'Company updated',
            description: 'Company has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: Error) => {
          toast({
            title: 'Error updating company',
            description: error?.message || 'Failed to update company.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[96vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Edit Company</DrawerTitle>
          <DrawerDescription>Update company details.</DrawerDescription>
        </DrawerHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4">
            {/* Same form fields as CreateCompanyDrawer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corporation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+44 123 456 7890" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main Street" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="London" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="United Kingdom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="team_members"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Team Members</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter names separated by commas or new lines"
                        rows={4}
                        value={formatTeamMembers(field.value)}
                        onChange={(e) => {
                          const parsed = parseTeamMembers(e.target.value);
                          field.onChange(parsed);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Separate names with commas or new lines
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional notes..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DrawerFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Updating...' : 'Update Company'}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </DrawerFooter>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};
```

**Key Points:**
- Pre-fills form with existing company data
- `useEffect` resets form when drawer opens with new company
- Team members formatted as comma-separated string for display

---

## Task 6: Create DeleteCompanyDialog Component

**File:** `src/modules/companies/components/DeleteCompanyDialog.tsx`  
**Action:** CREATE

**Complete Code:**

```typescript
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { useDeleteCompany, type Company } from '../hooks/useCompanies';
import { useToast } from '@/shared/hooks/use-toast';

interface DeleteCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
}

export const DeleteCompanyDialog: React.FC<DeleteCompanyDialogProps> = ({
  open,
  onOpenChange,
  company,
}) => {
  const { mutate: deleteCompany, isPending } = useDeleteCompany();
  const { toast } = useToast();

  const handleDelete = () => {
    deleteCompany(company.id, {
      onSuccess: () => {
        toast({
          title: 'Company deleted',
          description: `${company.name} has been deleted successfully.`,
        });
        onOpenChange(false);
      },
      onError: (error: Error) => {
        toast({
          title: 'Error deleting company',
          description: error?.message || 'Failed to delete company.',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete{' '}
            <strong>{company.name}</strong>
            {company.email && ` (${company.email})`}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
```

**Key Points:**
- Shows company name and email in confirmation
- Loading state on delete button
- Toast notifications

---

## Task 7: Build CompaniesPage

**File:** `src/modules/companies/pages/CompaniesPage.tsx`  
**Action:** CREATE

**Complete Code:**

```typescript
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
```

**Key Points:**
- Search filters by name, email, phone
- Team members displayed as count
- Loading, error, and empty states
- Actions open drawers/dialog with selected company

---

## Task 8: Add Module Barrel

**File:** `src/modules/companies/index.ts`  
**Action:** CREATE

**Complete Code:**

```typescript
export { CompaniesPage } from './pages/CompaniesPage';
export { CreateCompanyDrawer } from './components/CreateCompanyDrawer';
export { EditCompanyDrawer } from './components/EditCompanyDrawer';
export { DeleteCompanyDialog } from './components/DeleteCompanyDialog';
export * from './hooks/useCompanies';
export * from './schemas/company.schema';
export * from './utils/companyTransform';
```

---

## Task 9: Update Router

**File:** `src/app/router.tsx`  
**Action:** UPDATE

**Change:** Add import and route:

```typescript
import { CompaniesPage } from "@/modules/companies";
// ... existing imports ...

<Route path="companies" element={<CompaniesPage />} />
```

**Full context:**
```typescript
<Route path="/dashboard" element={<DashboardLayout />}>
  {/* ... existing routes ... */}
  <Route path="companies" element={<CompaniesPage />} />
</Route>
```

---

## Task 10: Update Sidebar Navigation

**File:** `src/app/layout/AppSidebar.tsx`  
**Action:** UPDATE

**Change:** Add navigation item:

```typescript
import { Building2 } from 'lucide-react';
// ... existing imports ...

const navigationItems = [
  // ... existing items ...
  { title: "Companies", url: "/dashboard/companies", icon: Building2 },
];
```

---

## Task 11: Validation & QA

**Actions:**

1. **TypeScript Check:**
   ```bash
   npm run build
   ```
   - Verify no TypeScript errors
   - Check all imports resolve correctly

2. **Linter Check:**
   ```bash
   npm run lint
   ```
   - Fix any linting errors
   - Ensure code style consistency

3. **Manual Testing:**
   - Navigate to `/dashboard/companies`
   - Create a company with team members
   - Edit company and verify team members persist
   - Delete company
   - Test search functionality
   - Verify empty state renders
   - Check loading states
   - Test error handling

---

## Validation Checklist

- [ ] Routes include `/dashboard/companies` and render without errors
- [ ] Sidebar shows "Companies" with Building2 icon and active state
- [ ] Zod schema enforces required name and email format (when provided)
- [ ] Optional fields accept empty strings; payload normalizes to `null`
- [ ] `team_members` array persists correctly (create/edit/display)
- [ ] Team members input parses comma/newline-separated names correctly
- [ ] Query keys invalidate on create/update/delete; list refetches automatically
- [ ] Drawers/dialog close on success; toasts fire for success/error
- [ ] Loading, empty, and error states render correctly
- [ ] Search filters name/email/phone in-memory on fetched data
- [ ] Table displays team members count correctly
- [ ] All imports use `@/` aliases; no relative cross-module leaks
- [ ] `npm run lint` and `npm run build` succeed
- [ ] No TypeScript errors; all types properly exported
- [ ] Database table `companies` exists with correct schema
- [ ] RLS policies allow operations (Phase 1)

---

## Success Criteria

✅ Companies module delivers live Supabase CRUD with working drawers/dialog, searchable table, route/sidebar integration, and clean build with no console errors. Query invalidation keeps list in sync after create/update/delete. Team members array field works correctly for Phase 1 (simple text array storage).

---

## Implementation Notes

### Team Members Field Handling

**Form Input:**
- Users enter names in a textarea (comma or newline-separated)
- `parseTeamMembers()` converts string → array
- Form state stores as `string[]`
- `formatTeamMembers()` converts array → string for display

**Database:**
- PostgreSQL `text[]` array type
- Supabase handles arrays natively
- No JSON serialization needed

**Display:**
- Table shows count: "3 members" or "-" if empty
- Future: Could show first few names with ellipsis

### Error Handling

- All Supabase operations throw errors
- React Query catches and exposes via `error` state
- Components show error messages with retry option
- Toast notifications for mutation errors

### Query Invalidation

- Create: Invalidates list query
- Update: Invalidates list + sets detail cache
- Delete: Invalidates list query
- All mutations trigger automatic refetch

---

*Implementation Plan created: Companies Module Phase 1*  
*Ready for execution via `/implement` command*

