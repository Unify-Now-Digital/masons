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

