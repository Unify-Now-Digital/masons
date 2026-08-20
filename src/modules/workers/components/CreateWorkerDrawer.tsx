import React from 'react';
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
import { useToast } from '@/shared/hooks/use-toast';
import { workerFormSchema, type WorkerFormData } from '../schemas/worker.schema';
import { useCreateWorker } from '../hooks/useWorkers';
import { AppDrawerLayout, DrawerSection, DrawerGrid } from '@/shared/components/drawer';

interface CreateWorkerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateWorkerDrawer: React.FC<CreateWorkerDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createWorker, isPending } = useCreateWorker();
  const { toast } = useToast();

  const form = useForm<WorkerFormData>({
    resolver: zodResolver(workerFormSchema),
    defaultValues: {
      full_name: '',
      phone: '',
      role: 'installer',
      notes: '',
      is_active: true,
    },
  });

  const onSubmit = (values: WorkerFormData) => {
    createWorker(
      {
        full_name: values.full_name,
        phone: values.phone || null,
        role: values.role,
        notes: values.notes || null,
        is_active: values.is_active,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Worker created',
            description: 'Worker has been created successfully.',
          });
          form.reset();
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const description =
            error instanceof Error ? error.message : 'Failed to create worker.';
          toast({
            title: 'Error creating worker',
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
              title="Create Worker"
              description="Add a new team member."
              primaryLabel={isPending ? 'Creating...' : 'Create Worker'}
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium">Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[60px]"
                      placeholder="Additional notes about this worker..."
                      rows={2}
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
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                        <FormLabel className="text-xs font-medium">Active</FormLabel>
                  </div>
                </FormItem>
              )}
            />
                </DrawerGrid>
              </DrawerSection>
            </AppDrawerLayout>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

