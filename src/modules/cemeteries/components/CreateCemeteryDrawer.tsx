import React from 'react';
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
import { useCreateCemetery } from '../hooks/useCemeteries';
import { AppDrawerLayout, DrawerSection, DrawerGrid } from '@/shared/components/drawer';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateCemeteryDrawer: React.FC<Props> = ({ open, onOpenChange }) => {
  const { mutate: createCemetery, isPending } = useCreateCemetery();
  const { toast } = useToast();

  const form = useForm<CemeteryFormData>({
    resolver: zodResolver(cemeteryFormSchema),
    defaultValues: {
      name: '',
      primary_email: '',
      phone: '',
      address: '',
      avg_approval_days: '',
      notes: '',
    },
  });

  useOnDrawerReset(() => {
    form.reset();
  });

  const onSubmit = (values: CemeteryFormData) => {
    createCemetery(toCemeteryInsert(values), {
      onSuccess: () => {
        toast({ title: 'Cemetery created', description: `${values.name} added.` });
        form.reset();
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        toast({
          title: 'Error creating cemetery',
          description: error instanceof Error ? error.message : 'Failed to create cemetery.',
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex flex-col max-h-[96vh] min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <AppDrawerLayout
              title="Create cemetery"
              description="Add a burial ground so orders and permit forms can link to it."
              primaryLabel={isPending ? 'Creating…' : 'Create cemetery'}
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
                          <Input className="h-9" placeholder="St Mark's Cemetery" {...field} />
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
                          <Input className="h-9" type="email" placeholder="clerk@stmarks.org" {...field} />
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
                          <Input className="h-9" placeholder="+44 123 456 7890" {...field} />
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
                          <Input className="h-9" placeholder="1 Cemetery Road, London" {...field} />
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
                            placeholder="28"
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
                        <Textarea
                          rows={3}
                          placeholder="Any rules, quirks or contact preferences…"
                          {...field}
                        />
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
