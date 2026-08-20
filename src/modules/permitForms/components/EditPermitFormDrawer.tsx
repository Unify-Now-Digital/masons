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
import { useUpdatePermitForm } from '../hooks/usePermitForms';
import type { PermitForm } from '../api/permitForms.api';

interface EditPermitFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permitForm: PermitForm;
}

export const EditPermitFormDrawer: React.FC<EditPermitFormDrawerProps> = ({
  open,
  onOpenChange,
  permitForm,
}) => {
  const { mutate: updatePermitForm, isPending } = useUpdatePermitForm();
  const { toast } = useToast();

  const form = useForm<PermitFormFormData>({
    resolver: zodResolver(permitFormSchema),
    defaultValues: {
      name: permitForm.name || '',
      link: permitForm.link || '',
      note: permitForm.note || '',
    },
  });

  useEffect(() => {
    if (open && permitForm) {
      form.reset({
        name: permitForm.name || '',
        link: permitForm.link || '',
        note: permitForm.note || '',
      });
    }
  }, [open, permitForm, form]);

  const onSubmit = (values: PermitFormFormData) => {
    updatePermitForm(
      {
        id: permitForm.id,
        updates: {
          name: values.name.trim(),
          link: values.link?.trim() ? values.link.trim() : null,
          note: values.note?.trim() ? values.note.trim() : null,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Permit form updated',
            description: 'Changes saved successfully.',
          });
          onOpenChange(false);
        },
        onError: (error: unknown) => {
          const description =
            error instanceof Error ? error.message : 'Failed to update permit form.';
          toast({
            title: 'Error updating permit form',
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
              title="Edit Permit Form"
              description="Update permit form details."
              primaryLabel={isPending ? 'Updating...' : 'Save Changes'}
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

