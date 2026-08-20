import React, { useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Drawer, DrawerContent } from '@/shared/components/ui/drawer';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { useToast } from '@/shared/hooks/use-toast';
import { workerFormSchema, type WorkerFormData } from '../schemas/worker.schema';
import { useUpdateWorker, type Worker } from '../hooks/useWorkers';
import { WorkerAvailabilityEditor } from './WorkerAvailabilityEditor';
import { AppDrawerLayout, DrawerSection, DrawerGrid } from '@/shared/components/drawer';

interface EditWorkerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker: Worker;
}

export const EditWorkerDrawer: React.FC<EditWorkerDrawerProps> = ({
  open,
  onOpenChange,
  worker,
}) => {
  const { mutate: updateWorker, isPending } = useUpdateWorker();
  const { toast } = useToast();

  const defaultValues = useMemo<WorkerFormData>(
    () => ({
      full_name: worker.full_name || '',
      phone: worker.phone || '',
      role: worker.role,
      notes: worker.notes || '',
      is_active: worker.is_active,
    }),
    [worker]
  );

  const form = useForm<WorkerFormData>({
    resolver: zodResolver(workerFormSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const onSubmit = (values: WorkerFormData) => {
    updateWorker(
      {
        id: worker.id,
        updates: {
          full_name: values.full_name,
          phone: values.phone || null,
          role: values.role,
          notes: values.notes || null,
          is_active: values.is_active,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Worker updated',
            description: 'Worker has been updated successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const description =
            error instanceof Error ? error.message : 'Failed to update worker.';
          toast({
            title: 'Error updating worker',
            description,
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0 [--background:40_50%_98%]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Edit Worker"
              description="Update worker information and availability."
              onClose={() => onOpenChange(false)}
              primaryLabel={isPending ? 'Updating...' : 'Update Worker'}
              primaryDisabled={isPending}
              primaryType="submit"
              onSecondary={() => onOpenChange(false)}
            >
              <Tabs defaultValue="details" className="px-4 pb-4">
                <TabsList className="mb-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="availability">Availability</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="mt-0">
                  <DrawerSection>
                    <DrawerGrid cols={2}>
                      <FormField
                        control={form.control}
                        name="full_name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Full Name</FormLabel>
                            <FormControl>
                              <Input className="h-9" placeholder="John Smith" {...field} />
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
                              <Input
                                className="h-9"
                                placeholder="+44 20 1234 5678"
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Role</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="installer">Installer</SelectItem>
                                <SelectItem value="driver">Driver</SelectItem>
                                <SelectItem value="stonecutter">Stonecutter</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-[11px]" />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="is_active"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-6">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="text-xs font-medium leading-none">Active</FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-xs font-medium">Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                className="min-h-[60px]"
                                rows={2}
                                placeholder="Additional notes about this worker..."
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                          </FormItem>
                        )}
                      />
                    </DrawerGrid>
                  </DrawerSection>
                </TabsContent>
                <TabsContent value="availability" className="mt-0">
                  <WorkerAvailabilityEditor workerId={worker.id} />
                </TabsContent>
              </Tabs>
            </AppDrawerLayout>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

