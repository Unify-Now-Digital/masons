import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Drawer,
  DrawerContent,
  useOnDrawerReset,
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
import { useToast } from '@/shared/hooks/use-toast';
import { cemeteryFormSchema, type CemeteryFormData } from '../schemas/cemetery.schema';
import { toCemeteryInsert } from '../utils/cemeteryTransform';
import { useUpdateCemetery, type Cemetery } from '../hooks/useCemeteries';
import { AppDrawerLayout, DrawerSection, DrawerGrid } from '@/shared/components/drawer';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cemetery: Cemetery;
}

export const EditCemeteryDrawer: React.FC<Props> = ({ open, onOpenChange, cemetery }) => {
  const { mutate: updateCemetery, isPending } = useUpdateCemetery();
  const { toast } = useToast();

  const form = useForm<CemeteryFormData>({
    resolver: zodResolver(cemeteryFormSchema),
    defaultValues: {
      name: cemetery.name ?? '',
      primary_email: cemetery.primary_email ?? '',
      phone: cemetery.phone ?? '',
      address: cemetery.address ?? '',
      avg_approval_days:
        cemetery.avg_approval_days == null ? '' : cemetery.avg_approval_days,
      notes: cemetery.notes ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      name: cemetery.name ?? '',
      primary_email: cemetery.primary_email ?? '',
      phone: cemetery.phone ?? '',
      address: cemetery.address ?? '',
      avg_approval_days:
        cemetery.avg_approval_days == null ? '' : cemetery.avg_approval_days,
      notes: cemetery.notes ?? '',
    });
  }, [cemetery, form]);

  useOnDrawerReset(() => {
    // No-op; reset handled via useEffect on cemetery change.
  });

  const onSubmit = (values: CemeteryFormData) => {
    updateCemetery(
      { id: cemetery.id, updates: toCemeteryInsert(values) },
      {
        onSuccess: () => {
          toast({ title: 'Cemetery updated', description: `${values.name} saved.` });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          toast({
            title: 'Error updating cemetery',
            description: error instanceof Error ? error.message : 'Failed to update cemetery.',
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Edit cemetery"
              description="Update contact details, approval time, and notes."
              primaryLabel={isPending ? 'Saving…' : 'Save changes'}
              primaryDisabled={isPending}
              primaryType="submit"
              secondaryLabel="Cancel"
              onSecondary={() => onOpenChange(false)}
              onClose={() => onOpenChange(false)}
            >
              <DrawerSection>
                <DrawerGrid cols={2}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="text-xs font-medium">Name *</FormLabel>
                        <FormControl>
                          <Input className="h-9" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="primary_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Primary email</FormLabel>
                        <FormControl>
                          <Input className="h-9" type="email" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Phone</FormLabel>
                        <FormControl>
                          <Input className="h-9" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="text-xs font-medium">Address</FormLabel>
                        <FormControl>
                          <Input className="h-9" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="avg_approval_days"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Avg approval (days)</FormLabel>
                        <FormControl>
                          <Input
                            className="h-9"
                            type="number"
                            min={0}
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />
                </DrawerGrid>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Notes</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} />
                      </FormControl>
                      <FormMessage className="text-[11px]" />
                    </FormItem>
                  )}
                />
              </DrawerSection>
            </AppDrawerLayout>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};
