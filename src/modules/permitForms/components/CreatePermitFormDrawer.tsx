import React, { useEffect } from 'react';
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
import { useToast } from '@/shared/hooks/use-toast';
import { AppDrawerLayout, DrawerGrid, DrawerSection } from '@/shared/components/drawer';
import { permitFormSchema, type PermitFormFormData } from '../schemas/permitForm.schema';
import { useCreatePermitForm } from '../hooks/usePermitForms';

interface CreatePermitFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreatePermitFormDrawer: React.FC<CreatePermitFormDrawerProps> = ({
  open,
  onOpenChange,
}) => {
  const { mutate: createPermitForm, isPending } = useCreatePermitForm();
  const { toast } = useToast();

  const form = useForm<PermitFormFormData>({
    resolver: zodResolver(permitFormSchema),
    defaultValues: {
      name: '',
      link: '',
      note: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: '', link: '', note: '' });
    }
  }, [open, form]);

  const onSubmit = (values: PermitFormFormData) => {
    createPermitForm(
      {
        name: values.name.trim(),
        link: values.link?.trim() ? values.link.trim() : null,
        note: values.note?.trim() ? values.note.trim() : null,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Permit form created',
            description: 'Permit form has been created successfully.',
          });
          form.reset();
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const description =
            error instanceof Error ? error.message : 'Failed to create permit form.';
          toast({
            title: 'Error creating permit form',
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
              title="Create Permit Form"
              description="Add a new permit form record."
              primaryLabel={isPending ? 'Creating...' : 'Create Permit Form'}
              primaryDisabled={isPending}
              primaryType="submit"
              secondaryLabel="Cancel"
              onSecondary={() => onOpenChange(false)}
              onClose={() => onOpenChange(false)}
            >
              <DrawerSection title="Details">
                <DrawerGrid cols={2}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="text-xs font-medium">Name *</FormLabel>
                        <FormControl>
                          <Input className="h-9" placeholder="e.g., Cemetery Permit Form" {...field} />
                        </FormControl>
                        <FormMessage className="text-[11px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="link"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="text-xs font-medium">Link</FormLabel>
                        <FormControl>
                          <Input
                            className="h-9"
                            placeholder="Paste URL or any reference link"
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
                    name="note"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel className="text-xs font-medium">Note</FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-[60px]"
                            rows={2}
                            placeholder="Optional internal note…"
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
            </AppDrawerLayout>
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
};

